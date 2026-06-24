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

async function getClipboard(deviceId) {
    const output = await runCommand(
        `adb -s ${deviceId} shell dumpsys clipboard`
    );

    return {
        success: true,
        clipboard: output,
    };
}

async function setClipboard(
    deviceId,
    text
) {
    await runCommand(
        `adb -s ${deviceId} shell am broadcast -a clipper.set -e text "${text}"`
    );

    return {
        success: true,
        message: "Clipboard updated",
    };
}

module.exports = {
    getClipboard,
    setClipboard,
};