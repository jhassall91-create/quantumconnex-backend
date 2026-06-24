// ─────────────────────────────────────────────────────────────────
// FILE 3: heartbeat.js
// Reliable online/offline detection via ping/pong
//
// How it works:
//   - Server pings every device every PING_INTERVAL ms
//   - Device must respond within PONG_TIMEOUT ms
//   - If no response → marked offline automatically
//   - Client side: listen for "ping", respond with "pong"
// ─────────────────────────────────────────────────────────────────

const { getDevice, updateDevice, markOffline } = require("./redis-store");

const PING_INTERVAL = 30_000;   // ping every 30 seconds
const PONG_TIMEOUT  = 10_000;   // must respond within 10 seconds

// Tracks pending pong timers: deviceId → timeout handle
const pendingPongs = new Map();

// ─── Start heartbeat for a device ────────────────────────────────

function startHeartbeat(io, socket, deviceId) {
    // Clear any existing heartbeat for this device (reconnect case)
    stopHeartbeat(deviceId);

    const interval = setInterval(async () => {
        const device = await getDevice(deviceId);

        // Stop if device no longer exists
        if (!device) {
            stopHeartbeat(deviceId);
            return;
        }

        // Send ping to device
        socket.emit("ping");

        // Start pong timeout — if device doesn't respond in time, mark offline
        const timeout = setTimeout(async () => {
            console.log(`[heartbeat] no pong from ${deviceId} — marking offline`);
            await markOffline(deviceId);

            io.emit("device:status", {
                deviceId,
                status: "offline",
                lastSeen: Date.now(),
            });

            stopHeartbeat(deviceId);
        }, PONG_TIMEOUT);

        pendingPongs.set(deviceId, timeout);

    }, PING_INTERVAL);

    // Store interval handle on socket for cleanup
    socket._heartbeatInterval = interval;

    console.log(`[heartbeat] started for ${deviceId}`);
}

// ─── Handle pong response from device ────────────────────────────

async function handlePong(deviceId) {
    // Cancel the offline timeout — device is alive
    const timeout = pendingPongs.get(deviceId);
    if (timeout) {
        clearTimeout(timeout);
        pendingPongs.delete(deviceId);
    }

    // Update lastSeen
    await updateDevice(deviceId, {});
}

// ─── Stop heartbeat for a device ─────────────────────────────────

function stopHeartbeat(deviceId, socket = null) {
    // Clear pong timeout
    const timeout = pendingPongs.get(deviceId);
    if (timeout) {
        clearTimeout(timeout);
        pendingPongs.delete(deviceId);
    }

    // Clear ping interval if socket reference provided
    if (socket?._heartbeatInterval) {
        clearInterval(socket._heartbeatInterval);
        socket._heartbeatInterval = null;
    }

    console.log(`[heartbeat] stopped for ${deviceId}`);
}

// ─── Register heartbeat socket events ────────────────────────────
// Call this inside your io.on("connection") block

function registerHeartbeatHandlers(io, socket, getDeviceId) {
    /**
     * getDeviceId: function that returns the deviceId for this socket
     * e.g. () => socket._deviceId (set during device:register)
     */

    socket.on("pong", async () => {
        const deviceId = getDeviceId();
        if (deviceId) {
            await handlePong(deviceId);
        }
    });

    socket.on("disconnect", async () => {
        const deviceId = getDeviceId();
        if (deviceId) {
            stopHeartbeat(deviceId, socket);
            await markOffline(deviceId);

            io.emit("device:status", {
                deviceId,
                status: "offline",
                lastSeen: Date.now(),
            });
        }
    });
}

module.exports = {
    startHeartbeat,
    stopHeartbeat,
    handlePong,
    registerHeartbeatHandlers,
};


// ─────────────────────────────────────────────────────────────────
// CLIENT SIDE — add this to your mobile/desktop companion app
// ─────────────────────────────────────────────────────────────────
//
// socket.on("ping", () => {
//     socket.emit("pong");
// });
//
// That's all the client needs. The server handles everything else.
// ─────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────
// WIRING EXAMPLE — how to plug all 3 files into your index.js
// ─────────────────────────────────────────────────────────────────
//
// const { applySocketAuth } = require("./socket-middleware");
// const { addDevice, markOffline, getDeviceBySocketId,
//         getQueuedCommands, clearQueuedCommands } = require("./redis-store");
// const { startHeartbeat, registerHeartbeatHandlers } = require("./heartbeat");
//
// // 1. Apply auth middleware FIRST
// applySocketAuth(io);
//
// // 2. Connection handler
// io.on("connection", (socket) => {
//     let currentDeviceId = null;
//
//     socket.on("device:register", async ({ deviceId, platform, fingerprint }) => {
//         const userId = socket.user.userId; // set by middleware
//
//         // ... your existing register logic using redis-store functions ...
//
//         currentDeviceId = deviceId;
//         socket._deviceId = deviceId;
//
//         // 3. Start heartbeat after successful registration
//         startHeartbeat(io, socket, deviceId);
//
//         // 4. Replay queued commands
//         const queued = await getQueuedCommands(deviceId);
//         for (const cmd of queued) {
//             socket.emit("command:execute", cmd);
//         }
//         await clearQueuedCommands(deviceId);
//     });
//
//     // 5. Register heartbeat + disconnect handlers
//     registerHeartbeatHandlers(io, socket, () => currentDeviceId);
// });
