const devices = new Map();

/**
 * deviceId -> {
 *   socketId,
 *   userId,
 *   platform,
 *   status: "online" | "offline",
 *   lastSeen,
 *   connectedAt
 * }
 */

// ─── Add / register a device ──────────────────

function addDevice(deviceId, socketId, userId, platform) {
    const now = Date.now();
    const existing = devices.get(deviceId);

    devices.set(deviceId, {
        socketId,
        userId,
        platform,
        status: "online",
        lastSeen: now,
        connectedAt: existing?.connectedAt ?? now,
    });

    return devices.get(deviceId);
}

// ─── Get a device by deviceId ─────────────────

function getDevice(deviceId) {
    return devices.get(deviceId) ?? null;
}

// ─── Get all devices for a specific user ──────

function getDevicesByUser(userId) {
    const result = [];
    for (const [deviceId, device] of devices.entries()) {
        if (device.userId === userId) {
            result.push({ deviceId, ...device });
        }
    }
    return result;
}

// ─── Update any fields without overwriting ────

function updateDevice(deviceId, updates) {
    const device = devices.get(deviceId);
    if (!device) return null;

    const updated = {
        ...device,
        ...updates,
        lastSeen: Date.now(),
    };

    devices.set(deviceId, updated);
    return updated;
}

// ─── Mark offline instead of deleting ────────

function markOffline(deviceId) {
    const device = devices.get(deviceId);
    if (!device) return null;
    return updateDevice(deviceId, { status: "offline" });
}

// ─── Find device by socketId ──────────────────

function getDeviceBySocketId(socketId) {
    for (const [deviceId, device] of devices.entries()) {
        if (device.socketId === socketId) {
            return { deviceId, ...device };
        }
    }
    return null;
}

// ─── Get all online devices ───────────────────

function getOnlineDevices() {
    const online = [];
    for (const [deviceId, device] of devices.entries()) {
        if (device.status === "online") {
            online.push({ deviceId, ...device });
        }
    }
    return online;
}

// ─── Hard delete (use sparingly) ─────────────

function removeDevice(deviceId) {
    return devices.delete(deviceId);
}

module.exports = {
    addDevice,
    getDevice,
    getDevicesByUser,
    updateDevice,
    markOffline,
    removeDevice,
    getDeviceBySocketId,
    getOnlineDevices,
};
