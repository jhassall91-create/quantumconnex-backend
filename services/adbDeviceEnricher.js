const { exec } = require("child_process");

function runADB(command) {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout) => {
            if (err) {
                reject(err.message);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

/**
 * Adds metadata to each device
 */
async function enrichDevice(deviceId) {
    try {
        const model = await runADB(
            `adb -s ${deviceId} shell getprop ro.product.model`
        );

        const brand = await runADB(
            `adb -s ${deviceId} shell getprop ro.product.brand`
        );

        const androidVersion = await runADB(
            `adb -s ${deviceId} shell getprop ro.build.version.release`
        );

        return {
            deviceId,
            model,
            brand,
            androidVersion,
        };
    } catch (err) {
        return {
            deviceId,
            error: err,
        };
    }
}

module.exports = {
    enrichDevice,
};