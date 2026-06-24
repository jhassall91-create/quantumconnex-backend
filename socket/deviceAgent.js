import { io } from "socket.io-client";
import { getToken } from "../auth/token";

const socket = io("http://localhost:5000", {
    autoConnect: false,
    transports: ["websocket"],
});

export function startDeviceAgent(deviceId, platform) {
    socket.connect();

    socket.emit("agent:hello", {
        token: getToken(),
        deviceId,
        platform,
    });

    socket.on("command:execute", (command) => {
        console.log(
            "EXECUTE COMMAND:",
            command
        );

        // SIMULATED RESPONSE
        setTimeout(() => {
            socket.emit("command:response", {
                commandId: command.commandId,
                status: "completed",
                result: {
                    success: true,
                    message:
                        "Command executed on agent",
                },
            });
        }, 1000);
    });

    socket.on("connect", () => {
        setInterval(() => {
            socket.emit("agent:pulse", {
                deviceId,
            });
        }, 5000);
    });
}