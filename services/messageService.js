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

async function getSmsMessages(deviceId) {
    const output = await runCommand(
        `adb -s ${deviceId} shell content query --uri content://sms/inbox`
    );

    return {
        success: true,
        messages: output,
    };
}

module.exports = {
    getSmsMessages,
};