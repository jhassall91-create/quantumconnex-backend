const express = require("express");
const router = express.Router();
const { exec } = require("child_process");
const path = require("path");
const authMiddleware = require("../Middleware/authMiddleware");

// ─── ADB path — works whether or not it's in PATH ────
const ADB = process.env.ADB_PATH || "C:\\adb\\platform-tools\\adb.exe";

function runADB(command, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("ADB command timed out")), timeoutMs);
        exec(`"${ADB}" ${command}`, (err, stdout, stderr) => {
            clearTimeout(timer);
            if (err) {
                if (stderr && !stdout) resolve(stderr.trim());
                else reject(new Error(stderr || err.message));
                return;
            }
            resolve(stdout.trim() || stderr.trim() || "OK");
        });
    });
}

function runADBDevice(serial, command, timeoutMs = 15000) {
    return runADB(`-s "${serial}" ${command}`, timeoutMs);
}

// ── GET /api/recovery/check ───────────────────────────
router.get("/check", authMiddleware, async (req, res) => {
    try {
        const version = await runADB("version");
        res.json({ success: true, available: true, version: version.split("\n")[0] });
    } catch (err) {
        res.json({ success: true, available: false, version: null, error: err.message });
    }
});

// ── GET /api/recovery/devices ─────────────────────────
router.get("/devices", authMiddleware, async (req, res) => {
    try {
        const output = await runADB("devices -l");
        const lines = output.split("\n").slice(1).filter(l => l.trim() && !l.startsWith("*"));

        const devices = await Promise.all(lines.map(async (line) => {
            const parts = line.trim().split(/\s+/);
            const serial = parts[0];
            const state  = parts[1];

            let details = { serial, state, model: "Unknown", product: "Unknown", transport: "Unknown" };

            const modelMatch     = line.match(/model:(\S+)/);
            const productMatch   = line.match(/product:(\S+)/);
            const transportMatch = line.match(/transport_id:(\S+)/);

            if (modelMatch)     details.model     = modelMatch[1].replace(/_/g, " ");
            if (productMatch)   details.product   = productMatch[1];
            if (transportMatch) details.transport = transportMatch[1];

            if (state === "device") {
                try {
                    const [battery, sdk, android] = await Promise.all([
                        runADBDevice(serial, "shell dumpsys battery | grep level").catch(() => ""),
                        runADBDevice(serial, "shell getprop ro.build.version.sdk").catch(() => ""),
                        runADBDevice(serial, "shell getprop ro.build.version.release").catch(() => ""),
                    ]);
                    const battMatch = battery.match(/level:\s*(\d+)/);
                    details.battery = battMatch ? parseInt(battMatch[1]) : null;
                    details.sdk     = sdk.trim();
                    details.android = android.trim();
                } catch {}
            }

            return details;
        }));

        res.json({ success: true, devices: devices.filter(d => d.serial) });
    } catch (err) {
        res.json({ success: false, error: err.message, devices: [] });
    }
});

// ── POST /api/recovery/command ────────────────────────
router.post("/command", authMiddleware, async (req, res) => {
    const { serial, command, args = {} } = req.body;

    if (!serial || !command) {
        return res.status(400).json({ success: false, error: "serial and command required" });
    }

    try {
        let result = "";

        switch (command) {

            // ── Reboot ────────────────────────────────────
            case "reboot":
                await runADBDevice(serial, "reboot", 20000);
                result = "Device rebooting...";
                break;

            case "reboot_recovery":
                await runADBDevice(serial, "reboot recovery", 20000);
                result = "Rebooting into recovery mode...";
                break;

            case "reboot_bootloader":
                await runADBDevice(serial, "reboot bootloader", 20000);
                result = "Rebooting into bootloader/fastboot...";
                break;

            case "reboot_fastboot":
                await runADBDevice(serial, "reboot fastboot", 20000);
                result = "Rebooting into fastboot mode...";
                break;

            // ── Device info ───────────────────────────────
            case "device_info": {
                const [props, storage, mem] = await Promise.all([
                    runADBDevice(serial, "shell getprop").catch(() => ""),
                    runADBDevice(serial, "shell df /data | tail -1").catch(() => ""),
                    runADBDevice(serial, "shell cat /proc/meminfo | head -5").catch(() => ""),
                ]);

                const extract = (key) => {
                    const m = props.match(new RegExp(`\\[${key.replace(/\./g, "\\.")}\\]:\\s*\\[([^\\]]+)\\]`));
                    return m ? m[1] : "Unknown";
                };

                result = [
                    "── DEVICE INFORMATION ──────────────────",
                    `Model:       ${extract("ro.product.model")}`,
                    `Brand:       ${extract("ro.product.brand")}`,
                    `Android:     ${extract("ro.build.version.release")} (SDK ${extract("ro.build.version.sdk")})`,
                    `Build:       ${extract("ro.build.display.id")}`,
                    `Serial:      ${serial}`,
                    `Fingerprint: ${extract("ro.build.fingerprint")}`,
                    "",
                    "── STORAGE ─────────────────────────────",
                    storage || "unavailable",
                    "",
                    "── MEMORY ──────────────────────────────",
                    mem || "unavailable",
                ].join("\n");
                break;
            }

            // ── Screenshot ────────────────────────────────
            case "screenshot": {
                const ts = Date.now();
                const remotePath = `/sdcard/qc_screenshot_${ts}.png`;
                await runADBDevice(serial, `shell screencap -p ${remotePath}`, 10000);
                await runADBDevice(serial, `pull ${remotePath} "./screenshots/screenshot_${ts}.png"`, 15000);
                await runADBDevice(serial, `shell rm ${remotePath}`).catch(() => {});
                result = `Screenshot saved: screenshot_${ts}.png`;
                break;
            }

            // ── File operations ───────────────────────────
            case "list_files": {
                const filePath = args.path || "/sdcard/";
                result = await runADBDevice(serial, `shell ls -la "${filePath}"`, 10000);
                break;
            }

            case "pull_file": {
                if (!args.remotePath) throw new Error("remotePath required");
                const localName = args.remotePath.split("/").pop();
                result = await runADBDevice(serial, `pull "${args.remotePath}" "./pulled/${localName}"`, 30000);
                break;
            }

            // ── Shell ─────────────────────────────────────
            case "shell": {
                if (!args.cmd) throw new Error("cmd required");
                const blocked = ["rm -rf /", "format", "mkfs", "dd if="];
                if (blocked.some(b => args.cmd.toLowerCase().includes(b))) {
                    throw new Error("Blocked: destructive command");
                }
                result = await runADBDevice(serial, `shell ${args.cmd}`, 15000);
                break;
            }

            // ── Apps ──────────────────────────────────────
            case "list_apps": {
                const raw = await runADBDevice(serial, "shell pm list packages -3", 10000);
                result = raw.replace(/package:/g, "").trim() || "No third-party apps found";
                break;
            }

            case "clear_app_data": {
                if (!args.package) throw new Error("package required");
                result = await runADBDevice(serial, `shell pm clear ${args.package}`, 10000);
                break;
            }

            case "uninstall_app": {
                if (!args.package) throw new Error("package required");
                result = await runADBDevice(serial, `uninstall ${args.package}`, 15000);
                break;
            }

            // ── Network ───────────────────────────────────
            case "wifi_info": {
                result = await runADBDevice(serial, "shell dumpsys wifi | grep -E \"mWifiInfo|SSID|BSSID|rssi|ipaddr\"", 8000);
                break;
            }

            case "enable_wireless_adb": {
                const port = args.port || 5555;
                result = await runADBDevice(serial, `tcpip ${port}`, 8000);
                result += `\n\nWireless ADB enabled on port ${port}.\nNow connect with: adb connect <device-ip>:${port}`;
                break;
            }

            case "connect_wireless": {
                if (!args.ipAddress) throw new Error("ipAddress required");
                result = await runADB(`connect ${args.ipAddress}`, 10000);
                break;
            }

            case "disconnect_wireless": {
                if (!args.ipAddress) throw new Error("ipAddress required");
                result = await runADB(`disconnect ${args.ipAddress}`, 8000);
                break;
            }

            // ── Battery ───────────────────────────────────
            case "battery_info": {
                result = await runADBDevice(serial, "shell dumpsys battery", 8000);
                break;
            }

            // ── Logs ──────────────────────────────────────
            case "logcat_errors": {
                result = await runADBDevice(serial, "logcat -d *:E | tail -50", 10000);
                break;
            }

            case "bugreport_summary": {
                result = await runADBDevice(serial, "shell dumpsys activity | head -80", 15000);
                break;
            }

            // ── Sideload ──────────────────────────────────
            case "sideload_status": {
                const state = await runADBDevice(serial, "get-state", 5000).catch(() => "unknown");
                result = `Device state: ${state}\n\nTo sideload an APK:\nadb -s ${serial} install <path-to-apk>`;
                break;
            }

            // ── SMS (Android only) ────────────────────────
            case "sms_inbox": {
                result = await runADBDevice(serial,
                    `shell content query --uri content://sms/inbox --projection address,body,date | head -100`,
                    15000
                );
                break;
            }

            // ── Contacts ─────────────────────────────────
            case "list_contacts": {
                result = await runADBDevice(serial,
                    `shell content query --uri content://contacts/phones/ --projection display_name,number | head -100`,
                    15000
                );
                break;
            }

            // ── Call log ──────────────────────────────────
            case "call_log": {
                result = await runADBDevice(serial,
                    `shell content query --uri content://call_log/calls --projection number,date,duration,type | head -50`,
                    15000
                );
                break;
            }

            // ── Screen on/off ─────────────────────────────
            case "screen_on":
                result = await runADBDevice(serial, "shell input keyevent 26", 5000);
                result = "Screen toggled";
                break;

            case "unlock_screen":
                await runADBDevice(serial, "shell input keyevent 82", 5000);
                result = "Unlock keyevent sent";
                break;

            // ── Send text ─────────────────────────────────
            case "input_text": {
                if (!args.text) throw new Error("text required");
                const escaped = args.text.replace(/ /g, "%s");
                result = await runADBDevice(serial, `shell input text "${escaped}"`, 8000);
                result = `Text sent: ${args.text}`;
                break;
            }

            default:
                throw new Error(`Unknown command: ${command}`);
        }

        res.json({ success: true, output: result, command, serial, timestamp: new Date().toISOString() });
    } catch (err) {
        res.json({ success: false, error: err.message, command, serial });
    }
});

module.exports = router;