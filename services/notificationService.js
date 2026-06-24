const { exec } = require("child_process");

function runADB(command) {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                reject(stderr || err.message);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

async function getNotifications(deviceId) {
    const result = await runADB(
        `adb -s ${deviceId} shell dumpsys notification --noredact`
    );

    return {
        success: true,
        type: "notifications",
        data: result,
    };
}

module.exports = {
    getNotifications,
};