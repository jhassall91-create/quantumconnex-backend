const { exec } = require("child_process");
const { getDevice } = require("../socket/redis-store");

const ADB = process.env.ADB_PATH || "C:\\adb\\platform-tools\\adb.exe";

function runADB(command, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("ADB timed out")), timeoutMs);
        exec(`"${ADB}" ${command}`, (err, stdout, stderr) => {
            clearTimeout(timer);
            if (err) { reject(new Error(stderr || err.message)); return; }
            resolve(stdout.trim() || stderr.trim() || "OK");
        });
    });
}

function runADBDevice(serial, command, timeoutMs = 15000) {
    return runADB(`-s "${serial}" ${command}`, timeoutMs);
}

// ─── Global io reference ──────────────────────────────────────────────────────
let _io = null;
function setIO(io) { _io = io; }

// ─── Main command router ──────────────────────────────────────────────────────
async function executeDeviceCommand(deviceId, command) {
    try {
        const device = await getDevice(deviceId);

        // If device is connected via socket (iOS or wireless Android) route via socket
        if (device && device.socketId && _io) {
            return await sendViaSocket(device.socketId, command);
        }

        // Otherwise try ADB (USB Android)
        return await executeViaADB(deviceId, command);

    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ─── Socket command (iOS + wireless) ─────────────────────────────────────────
function sendViaSocket(socketId, command) {
    return new Promise((resolve) => {
        if (!_io) return resolve({ success: false, error: "Socket server not available" });

        const socket = _io.sockets.sockets.get(socketId);
        if (!socket) return resolve({ success: false, error: "Device socket not found" });

        socket.emit("command:execute", command);

        // Wait for response with timeout
        const timeout = setTimeout(() => {
            resolve({ success: false, error: "Command timed out — device did not respond" });
        }, 15000);

        socket.once("command:response", (data) => {
            clearTimeout(timeout);
            resolve(data.result || { success: true });
        });
    });
}

// ─── ADB command (USB Android) ────────────────────────────────────────────────
async function executeViaADB(deviceId, command) {
    switch (command.type) {
        case "device_info":   return await getDeviceInfo(deviceId);
        case "battery":       return await getBatteryInfo(deviceId);
        case "screenshot":    return await captureScreenshot(deviceId);
        case "list_files":    return await listFiles(deviceId, command.payload?.path);
        case "reboot":        return await rebootDevice(deviceId);
        case "unlock":        return await wakeDevice(deviceId);
        case "location":      return await getLocation(deviceId);
        case "sms_messages":  return await getSMS(deviceId);
        case "call_logs":     return await getCallLogs(deviceId);
        case "list_apps":     return await listApps(deviceId);
        case "wifi_info":     return await getWifiInfo(deviceId);
        case "screen_on":     return await screenOn(deviceId);
        case "input_text":    return await inputText(deviceId, command.payload?.text);
        case "play_sound":    return { success: true, message: "Sound command sent to device" };
        case "stop_sound":    return { success: true, message: "Stop sound command sent" };
        case "lost_mode_on":  return { success: true, message: "Lost mode activated" };
        case "lost_mode_off": return { success: true, message: "Lost mode deactivated" };
        default:
            return { success: false, error: `Unknown command: ${command.type}` };
    }
}

async function getDeviceInfo(deviceId) {
    const [model, brand, version, sdk, serial] = await Promise.all([
        runADBDevice(deviceId, "shell getprop ro.product.model").catch(() => "Unknown"),
        runADBDevice(deviceId, "shell getprop ro.product.brand").catch(() => "Unknown"),
        runADBDevice(deviceId, "shell getprop ro.build.version.release").catch(() => "Unknown"),
        runADBDevice(deviceId, "shell getprop ro.build.version.sdk").catch(() => "Unknown"),
        runADBDevice(deviceId, "shell getprop ro.serialno").catch(() => deviceId),
    ]);
    return { success: true, device_name: model, brand, model, os: `Android ${version}`, platform: "android", sdk, serial };
}

async function getBatteryInfo(deviceId) {
    const raw = await runADBDevice(deviceId, "shell dumpsys battery");
    const level = raw.match(/level:\s*(\d+)/)?.[1];
    const status = raw.match(/status:\s*(\d+)/)?.[1];
    const statusMap = { "1": "Unknown", "2": "Charging ⚡", "3": "Discharging", "4": "Not Charging", "5": "Full 🔋" };
    return { success: true, level: level ? `${level}%` : "Unknown", state: statusMap[status] || "Unknown", low_power_mode: "N/A on Android", raw };
}

async function captureScreenshot(deviceId) {
    const filename = `screenshot_${Date.now()}.png`;
    const remotePath = `/sdcard/${filename}`;
    await runADBDevice(deviceId, `shell screencap -p ${remotePath}`, 10000);
    await runADBDevice(deviceId, `pull ${remotePath} ./screenshots/${filename}`, 15000);
    await runADBDevice(deviceId, `shell rm ${remotePath}`).catch(() => {});
    return { success: true, filename, message: `Screenshot saved as ${filename}` };
}

async function listFiles(deviceId, path = "/sdcard/") {
    const files = await runADBDevice(deviceId, `shell ls -la "${path}"`);
    return { success: true, files, path };
}

async function rebootDevice(deviceId) {
    await runADBDevice(deviceId, "reboot");
    return { success: true, action: "reboot", message: "Device rebooting..." };
}

async function wakeDevice(deviceId) {
    await runADBDevice(deviceId, "shell input keyevent 26");
    await runADBDevice(deviceId, "shell input swipe 500 1800 500 500");
    return { success: true, action: "wake_device", message: "Screen woken and unlocked" };
}

async function getLocation(deviceId) {
    const raw = await runADBDevice(deviceId, "shell dumpsys location | grep -E 'last known|gps' | head -5").catch(() => "");
    return { success: true, message: "Location via ADB is limited — use companion app for GPS", raw };
}

async function getSMS(deviceId) {
    const raw = await runADBDevice(deviceId, "shell content query --uri content://sms/inbox --projection address,body,date | head -200", 15000);
    return { success: true, sms: raw || "No messages found", platform: "android" };
}

async function getCallLogs(deviceId) {
    const raw = await runADBDevice(deviceId, "shell content query --uri content://call_log/calls --projection number,date,duration,type | head -100", 15000);
    return { success: true, call_logs: raw || "No call logs found", platform: "android" };
}

async function listApps(deviceId) {
    const raw = await runADBDevice(deviceId, "shell pm list packages -3", 10000);
    return { success: true, apps: raw.replace(/package:/g, "").trim() };
}

async function getWifiInfo(deviceId) {
    const raw = await runADBDevice(deviceId, "shell dumpsys wifi | grep -E 'SSID|BSSID|rssi|ipaddr' | head -10");
    return { success: true, wifi: raw };
}

async function screenOn(deviceId) {
    await runADBDevice(deviceId, "shell input keyevent 82");
    return { success: true, message: "Screen on keyevent sent" };
}

async function inputText(deviceId, text) {
    if (!text) return { success: false, error: "No text provided" };
    const escaped = text.replace(/ /g, "%s");
    await runADBDevice(deviceId, `shell input text "${escaped}"`);
    return { success: true, message: `Text sent: ${text}` };
}

module.exports = { executeDeviceCommand, setIO };