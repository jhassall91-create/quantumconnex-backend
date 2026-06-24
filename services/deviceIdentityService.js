const crypto = require("crypto");

/**
 * In-memory identity store (upgrade later to MongoDB)
 */
const deviceIdentityStore = new Map();

/**
 * Generate cryptographic device fingerprint
 */
function generateDeviceFingerprint(deviceId, platform) {
    return crypto
        .createHash("sha256")
        .update(`${deviceId}-${platform}-${Date.now()}`)
        .digest("hex");
}

/**
 * Create trusted identity for device
 */
function registerDeviceIdentity(deviceId, userId, platform) {
    const fingerprint = generateDeviceFingerprint(
        deviceId,
        platform
    );

    const identity = {
        deviceId,
        userId,
        platform,
        fingerprint,
        trusted: false,
        createdAt: Date.now(),
        lastVerified: null,
    };

    deviceIdentityStore.set(deviceId, identity);

    return identity;
}

/**
 * Mark device as trusted after pairing/verification
 */
function trustDevice(deviceId) {
    const device = deviceIdentityStore.get(deviceId);
    if (!device) return null;

    device.trusted = true;
    device.lastVerified = Date.now();

    deviceIdentityStore.set(deviceId, device);

    return device;
}

/**
 * Validate device before allowing commands
 */
function validateDevice(deviceId, fingerprint) {
    const device = deviceIdentityStore.get(deviceId);

    if (!device) return false;
    if (!device.trusted) return false;

    return device.fingerprint === fingerprint;
}

/**
 * Get identity
 */
function getDeviceIdentity(deviceId) {
    return deviceIdentityStore.get(deviceId);
}

module.exports = {
    registerDeviceIdentity,
    trustDevice,
    validateDevice,
    getDeviceIdentity,
};