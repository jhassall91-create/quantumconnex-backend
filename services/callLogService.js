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

async function getCallLogs(deviceId) {
    const output = await runCommand(
        `adb -s ${deviceId} shell content query --uri content://call_log/calls`
    );

    return {
        success: true,
        callLogs: output,
    };
}

module.exports = {
    getCallLogs,
};