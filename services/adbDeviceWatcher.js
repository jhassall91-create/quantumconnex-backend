const { exec } = require("child_process");

let ioInstance = null;
let knownDevices = new Map();

/**
 * Attach socket.io instance from server
 */
function initADBWatcher(io) {
    ioInstance = io;
}

/**
 * Run adb command safely
 */
function runADB(command) {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                reject(stderr || err.message);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

/**
 * Parse adb devices output
 */
function parseDevices(output) {
    const lines = output.split("\n").slice(1);
    const devices = [];

    for (const line of lines) {
        if (!line.trim()) continue;

        const [deviceId, state] = line.split("\t");

        devices.push({
            deviceId,
            state,
            platform: "android",
        });
    }

    return devices;
}

/**
 * Core scan function
 */
async function scanDevices() {
    const output = await runADB("adb devices");
    return parseDevices(output);
}

/**
 * Diff detection system (real-time change tracking)
 */
function diffDevices(currentDevices) {
    const currentMap = new Map();

    for (const d of currentDevices) {
        currentMap.set(d.deviceId, d);
    }

    const added = [];
    const removed = [];

    // detect added
    for (const [id, device] of currentMap) {
        if (!knownDevices.has(id)) {
            added.push(device);
        }
    }

    // detect removed
    for (const [id, device] of knownDevices) {
        if (!currentMap.has(id)) {
            removed.push(device);
        }
    }

    knownDevices = currentMap;

    return { added, removed };
}

/**
 * Broadcast updates to frontend
 */
function broadcastChanges(changes) {
    if (!ioInstance) return;

    for (const device of changes.added) {
        ioInstance.emit("device:status", {
            deviceId: device.deviceId,
            status: "online",
            platform: device.platform,
        });
    }

    for (const device of changes.removed) {
        ioInstance.emit("device:status", {
            deviceId: device.deviceId,
            status: "offline",
            platform: device.platform,
        });
    }
}

/**
 * Main polling loop
 */
async function startADBWatcher(intervalMs = 3000) {
    console.log("[ADB WATCHER] Starting...");

    setInterval(async () => {
        try {
            const devices = await scanDevices();

            const changes = diffDevices(devices);

            if (
                changes.added.length ||
                changes.removed.length
            ) {
                broadcastChanges(changes);
            }
        } catch (err) {
            console.log(
                "[ADB WATCHER ERROR]",
                err.message
            );
        }
    }, intervalMs);
}

module.exports = {
    initADBWatcher,
    startADBWatcher,
    scanDevices,
};