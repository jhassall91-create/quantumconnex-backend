const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

redis.on("connect", () => console.log("[redis] connected"));
redis.on("error", (err) => console.error("[redis] error:", err.message));

// ─────────────────────────────
// DEVICE STATE
// ─────────────────────────────
async function addDevice(deviceId, socketId, userId, platform) {
    const device = {
        deviceId,
        socketId,
        userId,
        platform,
        status: "online",
        lastSeen: Date.now(),
    };

    await redis.set(`device:${deviceId}`, JSON.stringify(device));
    await redis.sadd(`user:${userId}:devices`, deviceId);

    return device;
}

async function getDevice(deviceId) {
    const data = await redis.get(`device:${deviceId}`);
    return data ? JSON.parse(data) : null;
}

async function markOffline(deviceId) {
    const device = await getDevice(deviceId);
    if (!device) return;

    device.status = "offline";
    device.lastSeen = Date.now();

    await redis.set(`device:${deviceId}`, JSON.stringify(device));
}

async function trustDevice(deviceId) {
    await redis.set(`device:${deviceId}:trusted`, "true");
}

async function validateDevice(deviceId) {
    const trusted = await redis.get(`device:${deviceId}:trusted`);
    return trusted === "true";
}

// ─────────────────────────────
// COMMAND QUEUE
// ─────────────────────────────
async function queueCommand(deviceId, command) {
    await redis.rpush(
        `device:${deviceId}:commands`,
        JSON.stringify(command)
    );
}

async function getQueuedCommands(deviceId) {
    const list = await redis.lrange(
        `device:${deviceId}:commands`,
        0,
        -1
    );
    return list.map(cmd => JSON.parse(cmd));
}

async function clearQueuedCommands(deviceId) {
    await redis.del(`device:${deviceId}:commands`);
}

// ─────────────────────────────
// DEVICE REGISTRY
// ─────────────────────────────
async function registerDeviceIdentity(deviceId, userId, platform) {
    await redis.set(
        `device:${deviceId}:identity`,
        JSON.stringify({ userId, platform })
    );
}

// ─────────────────────────────
// PAIRING
// ─────────────────────────────
async function createPairingRequest(userId) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await redis.set(`pairing:${code}`, userId, "EX", 300);
    return code;
}

async function verifyPairingCode(code) {
    const userId = await redis.get(`pairing:${code}`);
    if (!userId) return null;
    return { userId };
}

async function consumePairingCode(code) {
    await redis.del(`pairing:${code}`);
}

module.exports = {
    redis,
    addDevice,
    getDevice,
    markOffline,
    trustDevice,
    validateDevice,
    queueCommand,
    getQueuedCommands,
    clearQueuedCommands,
    registerDeviceIdentity,
    createPairingRequest,
    verifyPairingCode,
    consumePairingCode,
};