const {
    addDevice, markOffline, getDevice,
    getQueuedCommands, clearQueuedCommands, queueCommand,
    registerDeviceIdentity, trustDevice, validateDevice,
    createPairingRequest, verifyPairingCode, consumePairingCode,
} = require("./redis-store");

const { scanDevices }  = require("../services/adbDeviceWatcher");
const Message          = require("../models/Message");
const Conversation     = require("../models/Conversation");
const DeviceLocation   = require("../models/DeviceLocation");
const jwt              = require("jsonwebtoken");

const PING_INTERVAL = 30000;
const PONG_TIMEOUT  = 10000;

const userSockets = new Map();

module.exports = (io) => {

    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) return next(new Error("AUTH_MISSING"));
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = { userId: decoded.id, email: decoded.email ?? null };
            next();
        } catch (err) {
            if (err.name === "TokenExpiredError") return next(new Error("AUTH_EXPIRED"));
            return next(new Error("AUTH_INVALID"));
        }
    });

    io.on("connection", (socket) => {
        console.log("Socket connected:", socket.id);

        let currentDeviceId   = null;
        let heartbeatInterval = null;
        let pongTimeout       = null;
        const userId          = socket.user.userId;

        if (!userSockets.has(userId)) userSockets.set(userId, new Set());
        userSockets.get(userId).add(socket.id);

        // ── Device register ──────────────────────────────────────────────────
        socket.on("device:register", async (data) => {
            try {
                const { deviceId, platform, fingerprint, pairingCode } = data;
                console.log("[register] deviceId:", deviceId, "platform:", platform);

                let uid = userId;
                currentDeviceId = deviceId;

                await registerDeviceIdentity(deviceId, uid, platform);

                if (pairingCode) {
                    const pairing = await verifyPairingCode(pairingCode);
                    if (!pairing) {
                        socket.emit("device:pairing_failed", { reason: "Invalid pairing code" });
                        return socket.disconnect();
                    }
                    uid = pairing.userId;
                    await consumePairingCode(pairingCode);
                    socket.emit("device:paired", { status: "paired", userId: uid });
                }

                if (fingerprint) {
                    const valid = await validateDevice(deviceId, fingerprint);
                    if (!valid) {
                        socket.emit("device:rejected", { reason: "Invalid fingerprint" });
                        return socket.disconnect();
                    }
                }

                await trustDevice(deviceId);
                await addDevice(deviceId, socket.id, uid, platform);

                socket.join(`device:${deviceId}`);
                socket.join(`user:${uid}`);

                socket.emit("device:bound", { deviceId, status: "trusted" });
                io.emit("device:status", { deviceId, status: "online", platform });

                console.log("[register] SUCCESS:", deviceId);

                // Deliver queued commands
                const queuedCommands = await getQueuedCommands(deviceId);
                if (queuedCommands.length > 0) {
                    for (const command of queuedCommands) {
                        socket.emit("command:execute", command);
                    }
                    await clearQueuedCommands(deviceId);
                    socket.emit("offline:queue:delivered", { deviceId, count: queuedCommands.length });
                }

                // Join all user conversations for chat
                const convos = await Conversation.find({ "participants.userId": uid });
                convos.forEach(c => socket.join(`chat:${c._id}`));

                // Send saved locations to this socket
                try {
                    const savedLocs = await DeviceLocation.find({ userId: uid })
                        .sort({ updatedAt: -1 })
                        .limit(50);

                    if (savedLocs.length > 0) {
                        socket.emit("locations:saved", savedLocs.map(l => ({
                            deviceId:  l.deviceId,
                            latitude:  l.latitude,
                            longitude: l.longitude,
                            accuracy:  l.accuracy,
                            altitude:  l.altitude,
                            updatedAt: l.updatedAt,
                            history:   l.history || [],
                        })));
                    }
                } catch (err) {
                    console.log("[locations] load error:", err.message);
                }

                // Heartbeat
                heartbeatInterval = setInterval(() => {
                    socket.emit("ping");
                    pongTimeout = setTimeout(async () => {
                        console.log(`[heartbeat] no pong from ${deviceId}`);
                        await markOffline(deviceId);
                        io.emit("device:status", { deviceId, status: "offline", lastSeen: Date.now() });
                        clearInterval(heartbeatInterval);
                    }, PONG_TIMEOUT);
                }, PING_INTERVAL);

            } catch (err) {
                console.log("Register error:", err.message);
                socket.disconnect();
            }
        });

        // ── Heartbeat ────────────────────────────────────────────────────────
        socket.on("pong", () => {
            if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
        });

        // ── Device location — SAVE TO MONGODB ───────────────────────────────
        socket.on("device:location", async (data) => {
            try {
                const { deviceId, latitude, longitude, accuracy, altitude, timestamp } = data;
                if (!deviceId || !latitude || !longitude) return;

                console.log(`[location] ${deviceId}: ${latitude}, ${longitude}`);

                // Broadcast to all clients
                io.emit("device:location", {
                    deviceId, latitude, longitude,
                    accuracy: accuracy || 0,
                    altitude: altitude || null,
                    timestamp: timestamp || Date.now(),
                });

                // Save/update in MongoDB
                const historyPoint = {
                    latitude,
                    longitude,
                    accuracy:  accuracy || 0,
                    altitude:  altitude || null,
                    timestamp: new Date(timestamp || Date.now()),
                };

                await DeviceLocation.findOneAndUpdate(
                    { deviceId },
                    {
                        $set: {
                            deviceId,
                            userId,
                            latitude,
                            longitude,
                            accuracy:  accuracy || 0,
                            altitude:  altitude || null,
                            updatedAt: new Date(),
                        },
                        $push: {
                            history: {
                                $each:  [historyPoint],
                                $slice: -500, // Keep last 500 points
                            },
                        },
                    },
                    { upsert: true, new: true }
                );

                console.log(`[location] saved to DB: ${deviceId}`);
            } catch (err) {
                console.log("[location] save error:", err.message);
            }
        });

        // ── Commands ─────────────────────────────────────────────────────────
        socket.on("command:send", async (command) => {
            console.log("[command:send] type:", command.type, "deviceId:", command.deviceId);
            const device = await getDevice(command.deviceId);

            if (!device || device.status === "offline") {
                await queueCommand(command.deviceId, command);
                return io.emit("command:update", {
                    commandId: command.commandId,
                    status: "queued",
                    message: "Device offline. Command queued.",
                });
            }

            const deviceSocket = io.sockets.sockets.get(device.socketId);
            if (!deviceSocket) {
                await queueCommand(command.deviceId, command);
                return io.emit("command:update", {
                    commandId: command.commandId,
                    status: "queued",
                    message: "Device socket not found. Command queued.",
                });
            }

            console.log("[command:send] sending to:", device.socketId);
            deviceSocket.emit("command:execute", command);
            io.emit("command:update", { commandId: command.commandId, status: "sent" });
        });

        socket.on("command:response", async (data) => {
            console.log("[command:response] type:", data.type, "status:", data.status);

            // If location command came back, save it too
            if (data.type === "location" && data.result?.latitude) {
                try {
                    const { latitude, longitude, accuracy, altitude } = data.result;
                    const historyPoint = { latitude, longitude, accuracy: accuracy || 0, altitude: altitude || null, timestamp: new Date() };

                    await DeviceLocation.findOneAndUpdate(
                        { deviceId: data.deviceId },
                        {
                            $set: {
                                deviceId:  data.deviceId,
                                userId,
                                latitude,
                                longitude,
                                accuracy:  accuracy || 0,
                                altitude:  altitude || null,
                                updatedAt: new Date(),
                            },
                            $push: {
                                history: {
                                    $each:  [historyPoint],
                                    $slice: -500,
                                },
                            },
                        },
                        { upsert: true, new: true }
                    );

                    // Broadcast the location update
                    io.emit("device:location", {
                        deviceId:  data.deviceId,
                        latitude,
                        longitude,
                        accuracy:  accuracy || 0,
                        altitude:  altitude || null,
                        timestamp: Date.now(),
                    });

                    console.log(`[location] command response saved: ${data.deviceId}`);
                } catch (err) {
                    console.log("[location] command save error:", err.message);
                }
            }

            io.emit("command:update", {
                commandId: data.commandId,
                type:      data.type,
                status:    data.status,
                result:    data.result,
                deviceId:  data.deviceId,
            });
        });

        // ── Notification mirroring ───────────────────────────────────────────
        socket.on("notification:received", (data) => {
            io.emit("notification:received", data);
        });

        // ── QUANTUM CHAT ─────────────────────────────────────────────────────
        socket.on("chat:send", async (data) => {
            try {
                const { conversationId, content, type, senderName, senderDevice, mediaUrl } = data;

                const msg = await Message.create({
                    conversationId,
                    senderId:     userId,
                    senderName:   senderName || socket.user.email || "Unknown",
                    senderDevice: senderDevice || null,
                    content:      content || "",
                    type:         type || "text",
                    mediaUrl:     mediaUrl || null,
                });

                await Conversation.findByIdAndUpdate(conversationId, {
                    lastMessage: {
                        content:    content,
                        senderId:   userId,
                        senderName: senderName || socket.user.email,
                        timestamp:  new Date(),
                    },
                    updatedAt: new Date(),
                });

                io.to(`chat:${conversationId}`).emit("chat:message", {
                    ...msg.toObject(),
                    conversationId,
                });

                console.log(`[chat] ${userId} → ${conversationId}: ${content?.substring(0, 50)}`);
            } catch (err) {
                console.log("[chat:send] error:", err.message);
                socket.emit("chat:error", { message: err.message });
            }
        });

        socket.on("chat:join", async (data) => {
            const { conversationId } = data;
            socket.join(`chat:${conversationId}`);

            await Message.updateMany(
                { conversationId, "readBy.userId": { $ne: userId } },
                { $push: { readBy: { userId, readAt: new Date() } } }
            );

            io.to(`chat:${conversationId}`).emit("chat:read", { conversationId, userId });
        });

        socket.on("chat:typing", (data) => {
            const { conversationId, isTyping, userName } = data;
            socket.to(`chat:${conversationId}`).emit("chat:typing", {
                conversationId, userId, userName, isTyping,
            });
        });

        socket.on("chat:create", async (data) => {
            try {
                const { name, type, participants } = data;
                let convo;

                if (type === "direct") {
                    convo = await Conversation.findOne({
                        type: "direct",
                        "participants.userId": { $all: participants.map(p => p.userId) },
                    });
                }

                if (!convo) {
                    convo = await Conversation.create({
                        name:         name || null,
                        type:         type || "direct",
                        participants: participants.map(p => ({ ...p, joinedAt: new Date() })),
                        createdBy:    userId,
                    });
                }

                participants.forEach(p => {
                    const socks = userSockets.get(p.userId);
                    if (socks) {
                        socks.forEach(sid => {
                            const s = io.sockets.sockets.get(sid);
                            if (s) s.join(`chat:${convo._id}`);
                        });
                    }
                });

                socket.emit("chat:created", convo);
                io.to(`chat:${convo._id}`).emit("chat:conversation_updated", convo);
            } catch (err) {
                socket.emit("chat:error", { message: err.message });
            }
        });

        // ── USB scan ─────────────────────────────────────────────────────────
        socket.on("usb:scan", async () => {
            try {
                const devices = await scanDevices();
                socket.emit("usb:devices", devices);
                io.emit("usb:scan:completed", { count: devices.length, devices });
            } catch (err) {
                socket.emit("usb:error", { message: err.message });
            }
        });

        // ── Pairing ──────────────────────────────────────────────────────────
        socket.on("pairing:create", async (data) => {
            try {
                const code = await createPairingRequest(data.userId);
                socket.emit("pairing:code", { code, deviceId: data.deviceId });
            } catch (err) {
                console.log(err.message);
            }
        });

        // ── Disconnect ───────────────────────────────────────────────────────
        socket.on("disconnect", async () => {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            if (pongTimeout) clearTimeout(pongTimeout);
            if (currentDeviceId) {
                await markOffline(currentDeviceId);
                io.emit("device:status", { deviceId: currentDeviceId, status: "offline" });
            }

            const socks = userSockets.get(userId);
            if (socks) {
                socks.delete(socket.id);
                if (socks.size === 0) userSockets.delete(userId);
            }

            console.log("Socket disconnected:", socket.id);
        });
    });
};