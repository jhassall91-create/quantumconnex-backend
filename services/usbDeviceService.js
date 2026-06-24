import {
    useEffect,
    useState,
} from "react";

import { io } from "socket.io-client";

const socket = io(
    "http://localhost:5000"
);

export default function USBPairingPanel() {
    const [devices, setDevices] =
        useState([]);

    useEffect(() => {
        socket.on(
            "adb:devices",
            (data) => {
                setDevices(
                    data
                );
            }
        );

        return () => {
            socket.off(
                "adb:devices"
            );
        };
    }, []);

    return (
        <div
            style={{
                padding: 20,
            }}
        >
            <h1>
                USB Device Monitor
            </h1>

            {devices.map(
                (
                    device,
                    index
                ) => (
                    <div
                        key={
                            index
                        }
                        style={{
                            border:
                                "1px solid #ccc",
                            padding: 10,
                            marginBottom: 10,
                        }}
                    >
                        <h3>
                            {
                                device.deviceId
                            }
                        </h3>

                        <div>
                            {
                                device.platform
                            }
                        </div>

                        <div>
                            {
                                device.state
                            }
                        </div>
                    </div>
                )
            )}
        </div>
    );
}