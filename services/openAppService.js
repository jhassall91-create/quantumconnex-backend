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

async function openApp(deviceId, packageName) {
    const result = await runADB(
        `adb -s ${deviceId} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`
    );

    return {
        success: true,
        type: "open_app",
        packageName,
        result,
    };
}

module.exports = {
    openApp,
};
