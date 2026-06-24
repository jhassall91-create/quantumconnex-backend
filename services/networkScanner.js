const { exec } = require("child_process");
const os = require("os");

function getLocalSubnet() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                const parts = iface.address.split(".");
                return `${parts[0]}.${parts[1]}.${parts[2]}`;
            }
        }
    }
    return "192.168.1";
}

function pingHost(ip, timeoutMs = 1000) {
    return new Promise((resolve) => {
        const cmd = process.platform === "win32"
            ? `ping -n 1 -w ${timeoutMs} ${ip}`
            : `ping -c 1 -W 1 ${ip}`;
        exec(cmd, (err, stdout) => {
            const alive = !err && (
                stdout.includes("TTL=") ||
                stdout.includes("ttl=") ||
                stdout.includes("1 received") ||
                stdout.includes("bytes from")
            );
            resolve({ ip, alive });
        });
    });
}

function getHostname(ip) {
    return new Promise((resolve) => {
        exec(`nslookup ${ip}`, (err, stdout) => {
            if (err || !stdout) return resolve(null);
            const match = stdout.match(/Name:\s+(.+)/i);
            resolve(match ? match[1].trim().split(".")[0] : null);
        });
    });
}

function getMac(ip) {
    return new Promise((resolve) => {
        exec(`arp -a ${ip}`, (err, stdout) => {
            if (err || !stdout) return resolve(null);
            const match = stdout.match(/([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i);
            resolve(match ? match[0].toUpperCase() : null);
        });
    });
}

function guessDeviceType(hostname, mac) {
    const h = (hostname || "").toLowerCase();
    if (h.includes("iphone") || h.includes("ipad")) return "ios";
    if (h.includes("macbook") || h.includes("imac")) return "mac";
    if (h.includes("android") || h.includes("samsung")) return "android";
    if (h.includes("windows") || h.includes("desktop")) return "windows";
    if (h.includes("router") || h.includes("gateway")) return "network";
    return "unknown";
}

async function scanNetwork(onProgress) {
    const subnet = getLocalSubnet();
    console.log(`[network-scan] Scanning ${subnet}.1 — ${subnet}.254`);

    const results = [];
    const BATCH   = 20;

    for (let start = 1; start <= 254; start += BATCH) {
        const end   = Math.min(start + BATCH - 1, 254);
        const batch = [];
        for (let i = start; i <= end; i++) batch.push(`${subnet}.${i}`);

        const pinged = await Promise.all(batch.map(ip => pingHost(ip)));
        const alive  = pinged.filter(r => r.alive);

        for (const { ip } of alive) {
            const [hostname, mac] = await Promise.all([getHostname(ip), getMac(ip)]);
            const type = guessDeviceType(hostname, mac);
            const device = {
                ip,
                hostname:   hostname || ip,
                mac:        mac || "Unknown",
                type,
                os:         type === "ios" ? "Apple" : type === "android" ? "Android" : type === "windows" ? "Windows" : "Unknown",
                discovered: new Date().toISOString(),
                source:     "network-scan",
            };
            results.push(device);
            if (onProgress) onProgress(device);
        }

        await new Promise(r => setTimeout(r, 50));
    }

    console.log(`[network-scan] Complete — ${results.length} devices found`);
    return results;
}

module.exports = { scanNetwork, getLocalSubnet };