const crypto = require("crypto");

const pairingRequests = new Map();

/**
 * userId -> { code, deviceId, platform, createdAt }
 */

function generateCode() {
    return crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();
}

async function createPairingRequest(
    userId,
    deviceId,
    platform
) {
    const code = generateCode();

    const request = {
        code,
        userId,
        deviceId,
        platform,
        createdAt: Date.now(),
        status: "pending",
    };

    pairingRequests.set(code, request);

    return request;
}

function verifyPairingCode(code) {
    return pairingRequests.get(code);
}

function consumePairingCode(code) {
    const request = pairingRequests.get(code);
    if (!request) return null;

    pairingRequests.delete(code);

    return request;
}

function getAllPairings() {
    return Array.from(pairingRequests.values());
}

module.exports = {
    createPairingRequest,
    verifyPairingCode,
    consumePairingCode,
    getAllPairings,
};