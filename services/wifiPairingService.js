import { useEffect, useState } from "react";
import { authHeaders } from "../auth/token";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
    autoConnect: false,
});

export default function DeviceDashboard() {
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] =
        useState(null);

    const [commandOutput, setCommandOutput] =
        useState("");

    const [remotePath, setRemotePath] =
        useState("/sdcard/Download");

    const [localPath, setLocalPath] =
        useState("C:/QuantumConnex");

    const [clipboardText, setClipboardText] =
        useState("");

    const [packageName, setPackageName] =
        useState("");

    useEffect(() => {
        loadDevices();

        socket.connect();

        socket.on("device:status", (data) => {
            setDevices((prev) => {
                const existing = prev.find(
                    (d) =>
                        d.deviceId ===
                        data.deviceId
                );

                if (existing) {
                    return prev.map((d) =>
                        d.deviceId ===
                        data.deviceId
                            ? {
                                  ...d,
                                  status:
                                      data.status,
                              }
                            : d
                    );
                }

                return [
                    ...prev,
                    {
                        deviceId:
                            data.deviceId,
                        platform:
                            data.platform ||
                            "android",
                        status:
                            data.status,
                    },
                ];
            });
        });

        socket.on("command:update", (data) => {
            setCommandOutput(
                JSON.stringify(
                    data.result,
                    null,
                    2
                )
            );
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const loadDevices = async () => {
        try {
            const res = await fetch(
                "http://localhost:5000/api/devices/my-devices",
                {
                    headers: authHeaders(),
                }
            );

            const data = await res.json();

            if (data.success) {
                setDevices(data.data);
            }
        } catch (err) {
            console.log(err);
        }
    };

    const sendCommand = (
        type,
        payload = {}
    ) => {
        if (!selectedDevice) return;

        socket.emit("command:send", {
            deviceId:
                selectedDevice.deviceId,
            commandId:
                Date.now().toString(),
            type,
            payload,
        });
    };

    return (
        <div style={{ padding: 20 }}>
            <h1>
                QuantumConnex Device Dashboard
            </h1>

            <div
                style={{
                    marginBottom: 20,
                }}
            >
                <button
                    onClick={() =>
                        socket.emit(
                            "usb:scan"
                        )
                    }
                >
                    Scan USB Devices
                </button>
            </div>

            <div
                style={{
                    display: "flex",
                    gap: 20,
                }}
            >
                <div style={{ width: "40%" }}>
                    <h2>Devices</h2>

                    {devices.map((d) => (
                        <div
                            key={d.deviceId}
                            onClick={() =>
                                setSelectedDevice(d)
                            }
                            style={{
                                padding: 12,
                                marginBottom: 10,
                                border:
                                    "1px solid #ccc",
                                cursor: "pointer",
                                background:
                                    selectedDevice?.deviceId ===
                                    d.deviceId
                                        ? "#f0f0f0"
                                        : "#fff",
                            }}
                        >
                            <h3>{d.deviceId}</h3>

                            <p>
                                Platform:{" "}
                                {d.platform}
                            </p>

                            <p>
                                Status: {d.status}
                            </p>
                        </div>
                    ))}
                </div>

                <div style={{ width: "60%" }}>
                    <h2>Device Controls</h2>

                    {selectedDevice ? (
                        <>
                            <p>
                                Active Device:
                                {" "}
                                {
                                    selectedDevice.deviceId
                                }
                            </p>

                            <div
                                style={{
                                    display: "flex",
                                    gap: 10,
                                    flexWrap:
                                        "wrap",
                                    marginBottom: 20,
                                }}
                            >
                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "device_info"
                                        )
                                    }
                                >
                                    Device Info
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "screenshot"
                                        )
                                    }
                                >
                                    Screenshot
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "reboot"
                                        )
                                    }
                                >
                                    Reboot
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "list_files"
                                        )
                                    }
                                >
                                    List Files
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "mirror_screen"
                                        )
                                    }
                                >
                                    Mirror Screen
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "notifications"
                                        )
                                    }
                                >
                                    Notifications
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "sms_messages"
                                        )
                                    }
                                >
                                    SMS Messages
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "call_logs"
                                        )
                                    }
                                >
                                    Call Logs
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "contacts"
                                        )
                                    }
                                >
                                    Contacts
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "location"
                                        )
                                    }
                                >
                                    Device Location
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "battery"
                                        )
                                    }
                                >
                                    Battery Status
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "get_clipboard"
                                        )
                                    }
                                >
                                    Get Clipboard
                                </button>
                            </div>

                            <h3>
                                Media Controls
                            </h3>

                            <div
                                style={{
                                    display: "flex",
                                    gap: 10,
                                    marginBottom: 20,
                                    flexWrap:
                                        "wrap",
                                }}
                            >
                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "media_play_pause"
                                        )
                                    }
                                >
                                    Play/Pause
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "media_next"
                                        )
                                    }
                                >
                                    Next Track
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "media_previous"
                                        )
                                    }
                                >
                                    Previous Track
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "volume_up"
                                        )
                                    }
                                >
                                    Volume Up
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "volume_down"
                                        )
                                    }
                                >
                                    Volume Down
                                </button>
                            </div>

                            <h3>
                                Clipboard Sync
                            </h3>

                            <textarea
                                value={
                                    clipboardText
                                }
                                onChange={(e) =>
                                    setClipboardText(
                                        e.target
                                            .value
                                    )
                                }
                                placeholder="Clipboard text"
                                style={{
                                    width: "100%",
                                    height: 100,
                                    marginBottom: 10,
                                }}
                            />

                            <button
                                onClick={() =>
                                    sendCommand(
                                        "set_clipboard",
                                        {
                                            text: clipboardText,
                                        }
                                    )
                                }
                            >
                                Set Clipboard
                            </button>

                            <h3
                                style={{
                                    marginTop: 20,
                                }}
                            >
                                Open Android App
                            </h3>

                            <input
                                type="text"
                                value={
                                    packageName
                                }
                                onChange={(e) =>
                                    setPackageName(
                                        e.target
                                            .value
                                    )
                                }
                                placeholder="com.example.app"
                                style={{
                                    width: "100%",
                                    marginBottom: 10,
                                }}
                            />

                            <button
                                onClick={() =>
                                    sendCommand(
                                        "open_app",
                                        {
                                            packageName,
                                        }
                                    )
                                }
                            >
                                Open App
                            </button>

                            <h3
                                style={{
                                    marginTop: 20,
                                }}
                            >
                                File Transfer
                            </h3>

                            <input
                                type="text"
                                value={remotePath}
                                onChange={(e) =>
                                    setRemotePath(
                                        e.target
                                            .value
                                    )
                                }
                                placeholder="Remote Path"
                                style={{
                                    width: "100%",
                                    marginBottom: 10,
                                }}
                            />

                            <input
                                type="text"
                                value={localPath}
                                onChange={(e) =>
                                    setLocalPath(
                                        e.target
                                            .value
                                    )
                                }
                                placeholder="Local Path"
                                style={{
                                    width: "100%",
                                    marginBottom: 10,
                                }}
                            />

                            <div
                                style={{
                                    display: "flex",
                                    gap: 10,
                                }}
                            >
                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "pull_file",
                                            {
                                                remotePath,
                                                localPath,
                                            }
                                        )
                                    }
                                >
                                    Pull File
                                </button>

                                <button
                                    onClick={() =>
                                        sendCommand(
                                            "push_file",
                                            {
                                                remotePath,
                                                localPath,
                                            }
                                        )
                                    }
                                >
                                    Push File
                                </button>
                            </div>

                            <pre
                                style={{
                                    marginTop: 20,
                                    background:
                                        "#111",
                                    color:
                                        "#00ff99",
                                    padding: 15,
                                    minHeight: 300,
                                    overflow:
                                        "auto",
                                    whiteSpace:
                                        "pre-wrap",
                                }}
                            >
                                {commandOutput}
                            </pre>
                        </>
                    ) : (
                        <p>
                            Select a device to
                            control
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}