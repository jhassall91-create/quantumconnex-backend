const { exec } = require("child_process");

function startScrcpy(deviceId) {
    return new Promise((resolve, reject) => {
        const process = exec(
            `scrcpy -s ${deviceId}`,
            (err) => {
                if (err) {
                    reject(err.message);
                }
            }
        );

        resolve({
            success: true,
            type: "scrcpy_started",
            pid: process.pid,
        });
    });
}

module.exports = {
    startScrcpy,
};