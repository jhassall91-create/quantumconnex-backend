const { exec } = require("child_process");

function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                reject(stderr || err.message);
                return;
            }

            resolve(stdout);
        });
    });
}

async function getDeviceLocation(deviceId) {
    const output = await runCommand(
        `adb -s ${deviceId} shell dumpsys location`
    );

    return {
        success: true,
        locationData: output,
    };
}

module.exports = {
    getDeviceLocation,
};