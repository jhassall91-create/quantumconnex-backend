const activeBridges = new Map();

/**
 * deviceId -> {
 *   type: "adb" | "bluetooth" | "usb" | "websocket",
 *   status,
 *   meta
 * }
 */

function registerBridge(deviceId, bridge) {
    activeBridges.set(deviceId, {
        ...bridge,
        status: "active",
        lastSeen: Date.now(),
    });
}

function getBridge(deviceId) {
    return activeBridges.get(deviceId);
}

function removeBridge(deviceId) {
    activeBridges.delete(deviceId);
}

function listBridges() {
    return Array.from(activeBridges.entries()).map(
        ([deviceId, data]) => ({
            deviceId,
            ...data,
        })
    );
}

function isBridgeActive(deviceId) {
    return activeBridges.has(deviceId);
}

module.exports = {
    registerBridge,
    getBridge,
    removeBridge,
    listBridges,
    isBridgeActive,
};