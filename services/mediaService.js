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

async function playPauseMedia(deviceId) {
    await runCommand(
        `adb -s ${deviceId} shell input keyevent 85`
    );

    return {
        success: true,
        action: "play_pause",
    };
}

async function nextTrack(deviceId) {
    await runCommand(
        `adb -s ${deviceId} shell input keyevent 87`
    );

    return {
        success: true,
        action: "next_track",
    };
}

async function previousTrack(deviceId) {
    await runCommand(
        `adb -s ${deviceId} shell input keyevent 88`
    );

    return {
        success: true,
        action: "previous_track",
    };
}

async function volumeUp(deviceId) {
    await runCommand(
        `adb -s ${deviceId} shell input keyevent 24`
    );

    return {
        success: true,
        action: "volume_up",
    };
}

async function volumeDown(deviceId) {
    await runCommand(
        `adb -s ${deviceId} shell input keyevent 25`
    );

    return {
        success: true,
        action: "volume_down",
    };
}

module.exports = {
    playPauseMedia,
    nextTrack,
    previousTrack,
    volumeUp,
    volumeDown,
};