const {
    validateDevice,
} = require("./deviceIdentityService");

/**
 * Blocks unauthorized command execution
 */
function secureExecute(deviceId, fingerprint, fn) {
    if (!validateDevice(deviceId, fingerprint)) {
        return {
            success: false,
            error: "Device not trusted",
        };
    }

    return fn();
}

module.exports = {
    secureExecute,
};