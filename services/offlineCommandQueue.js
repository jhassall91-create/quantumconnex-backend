const queue = new Map();

function queueCommand(deviceId, command) {
    if (!queue.has(deviceId)) {
        queue.set(deviceId, []);
    }
    queue.get(deviceId).push({ ...command, queuedAt: Date.now() });
}

function getQueuedCommands(deviceId) {
    return queue.get(deviceId) || [];
}

function clearQueuedCommands(deviceId) {
    queue.delete(deviceId);
}

module.exports = {
    queueCommand,
    getQueuedCommands,
    clearQueuedCommands,
};
