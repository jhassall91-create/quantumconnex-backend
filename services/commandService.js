const { v4: uuid } = require("uuid");

// Creates a command object ready to be emitted via socket
function createCommand({ deviceId, type, payload = {} }) {
    return {
        commandId: uuid(),
        deviceId,
        type,
        payload,
        status: "created",
        createdAt: Date.now(),
    };
}

module.exports = { createCommand };