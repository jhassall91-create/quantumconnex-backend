async function execute(deviceId, command) {
    console.log("[ADB EXECUTE]", deviceId, command);

    return {
        status: "adb_executed",
        deviceId,
        command
    };
}

module.exports = {
    execute
};