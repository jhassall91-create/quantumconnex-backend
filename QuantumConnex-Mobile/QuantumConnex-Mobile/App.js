import { useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Platform,
    Alert,
} from "react-native";
import * as Location from "expo-location";
import * as Device from "expo-device";
import { io } from "socket.io-client";

const SERVER_URL = "http://192.168.1.205:5000";

export default function App() {
    const [screen, setScreen] = useState("login"); // login | app
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [status, setStatus] = useState("disconnected");
    const [logs, setLogs] = useState([]);
    const [socket, setSocket] = useState(null);
    const [loading, setLoading] = useState(false);

    const [deviceId] = useState(
        Device.deviceName?.replace(/\s+/g, "-").toLowerCase() || "unknown-device"
    );

    const addLog = (msg) => {
        setLogs((prev) => [
            { id: Date.now(), msg, time: new Date().toLocaleTimeString() },
            ...prev.slice(0, 49),
        ]);
    };

    const login = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Please enter email and password");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${SERVER_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!data.token) {
                Alert.alert("Login failed", data.message || "Invalid credentials");
                return;
            }
            setToken(data.token);
            setScreen("app");
            connectToServer(data.token);
        } catch (err) {
            Alert.alert("Error", "Could not reach server. Make sure backend is running.");
        } finally {
            setLoading(false);
        }
    };

    const connectToServer = (authToken) => {
        const s = io(SERVER_URL, {
            transports: ["websocket"],
            auth: { token: authToken },
        });

        s.on("connect", () => {
            setStatus("connected");
            addLog("✅ Connected to QuantumConnex server");
            s.emit("device:register", {
                deviceId,
                platform: Platform.OS,
            });
        });

        s.on("device:bound", () => {
            addLog(`✅ Device registered: ${deviceId}`);
            startLocationUpdates(s);
        });

        s.on("command:execute", async (command) => {
            addLog(`⚡ Command: ${command.type}`);
            await handleCommand(s, command);
        });

        s.on("ping", () => s.emit("pong"));

        s.on("disconnect", () => {
            setStatus("disconnected");
            addLog("❌ Disconnected");
        });

        s.on("connect_error", (err) => {
            setStatus("error");
            addLog(`❌ Error: ${err.message}`);
        });

        setSocket(s);
    };

    const handleCommand = async (s, command) => {
        let result = { success: false, message: "Unknown command" };
        try {
            switch (command.type) {
                case "location":
                    const loc = await Location.getCurrentPositionAsync({});
                    result = {
                        success: true,
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        accuracy: loc.coords.accuracy,
                    };
                    break;
                case "device_info":
                    result = {
                        success: true,
                        deviceName: Device.deviceName,
                        brand: Device.brand,
                        modelName: Device.modelName,
                        osName: Device.osName,
                        osVersion: Device.osVersion,
                        platform: Platform.OS,
                    };
                    break;
                default:
                    result = { success: false, message: `${command.type} not supported yet` };
            }
        } catch (err) {
            result = { success: false, error: err.message };
        }

        s.emit("command:response", {
            commandId: command.commandId,
            deviceId,
            status: result.success ? "completed" : "failed",
            result,
        });
        addLog(`📤 Response sent: ${command.type}`);
    };

    const startLocationUpdates = async (s) => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
            addLog("⚠️ Location permission denied");
            return;
        }
        addLog("📍 Location tracking active");
        setInterval(async () => {
            try {
                const loc = await Location.getCurrentPositionAsync({});
                s.emit("device:location", {
                    deviceId,
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    timestamp: Date.now(),
                });
            } catch (err) {}
        }, 30000);
    };

    const statusColor = { connected: "#22c55e", disconnected: "#64748b", error: "#ef4444" }[status];

    // ── Login screen ──────────────────────────────
    if (screen === "login") {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>⚡ QuantumConnex</Text>
                    <Text style={styles.subtitle}>Sign in to connect your device</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>EMAIL</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor="#475569"
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    <Text style={styles.label}>PASSWORD</Text>
                    <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        placeholderTextColor="#475569"
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity
                    style={[styles.btnConnect, loading && { opacity: 0.6 }]}
                    onPress={login}
                    disabled={loading}
                >
                    <Text style={styles.btnText}>
                        {loading ? "SIGNING IN..." : "SIGN IN"}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.hint}>
                    Make sure your PC backend is running on {SERVER_URL}
                </Text>
            </View>
        );
    }

    // ── Main app screen ───────────────────────────
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>⚡ QuantumConnex</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                        {status.toUpperCase()}
                    </Text>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>DEVICE</Text>
                <Text style={styles.value}>{deviceId}</Text>
                <Text style={styles.label}>PLATFORM</Text>
                <Text style={styles.value}>{Platform.OS} · {Device.modelName}</Text>
            </View>

            <View style={[styles.card, { flex: 1 }]}>
                <Text style={styles.label}>ACTIVITY LOG</Text>
                <ScrollView style={{ flex: 1 }}>
                    {logs.length === 0 ? (
                        <Text style={styles.logEmpty}>Waiting for activity...</Text>
                    ) : (
                        logs.map((log) => (
                            <Text key={log.id} style={styles.logEntry}>
                                <Text style={styles.logTime}>{log.time} </Text>
                                {log.msg}
                            </Text>
                        ))
                    )}
                </ScrollView>
            </View>

            <TouchableOpacity
                style={styles.btnDisconnect}
                onPress={() => {
                    socket?.disconnect();
                    setSocket(null);
                    setScreen("login");
                    setStatus("disconnected");
                    setLogs([]);
                }}
            >
                <Text style={styles.btnText}>DISCONNECT</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0e1a",
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    header: {
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#f1f5f9",
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: "#475569",
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1,
    },
    card: {
        backgroundColor: "#0d1220",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#1e2840",
    },
    label: {
        fontSize: 10,
        color: "#475569",
        letterSpacing: 1.5,
        marginBottom: 6,
        marginTop: 4,
    },
    value: {
        fontSize: 14,
        color: "#e2e8f0",
        marginBottom: 8,
        fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    },
    input: {
        backgroundColor: "#050810",
        borderWidth: 1,
        borderColor: "#1e2840",
        borderRadius: 8,
        padding: 12,
        color: "#e2e8f0",
        fontSize: 15,
        marginBottom: 8,
    },
    btnConnect: {
        backgroundColor: "#2563eb",
        borderRadius: 10,
        padding: 16,
        alignItems: "center",
        marginBottom: 12,
    },
    btnDisconnect: {
        backgroundColor: "#7f1d1d",
        borderRadius: 10,
        padding: 14,
        alignItems: "center",
        marginTop: 8,
    },
    btnText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 14,
        letterSpacing: 1,
    },
    hint: {
        color: "#334155",
        fontSize: 11,
        textAlign: "center",
        marginTop: 8,
    },
    logEmpty: {
        color: "#334155",
        fontSize: 13,
    },
    logEntry: {
        color: "#94a3b8",
        fontSize: 12,
        marginBottom: 6,
        fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    },
    logTime: {
        color: "#475569",
    },
});
