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

async function pullFile(
    deviceId,
    remotePath,
    localPath
) {
    const result = await runADB(
        `adb -s ${deviceId} pull ${remotePath} ${localPath}`
    );

    return {
        success: true,
        type: "pull_file",
        result,
    };
}

async function pushFile(
    deviceId,
    localPath,
    remotePath
) {
    const result = await runADB(
        `adb -s ${deviceId} push ${localPath} ${remotePath}`
    );

    return {
        success: true,
        type: "push_file",
        result,
    };
}

module.exports = {
    pullFile,
    pushFile,
};