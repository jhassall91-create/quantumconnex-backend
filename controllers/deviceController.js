const { redis } = require("../socket/redis-store");

const getMyDevices = async (req, res) => {
    try {
        const userId = req.user.id;
        const keys = await redis.keys("device:*");
        const devices = [];

        for (const key of keys) {
            if (!key.startsWith("device:")) continue;
            const raw = await redis.get(key);
            if (!raw) continue;
            const device = JSON.parse(raw);
            if (device.userId === userId) {
                const deviceId = key.replace("device:", "");
                devices.push({ deviceId, ...device });
            }
        }

        res.json({ success: true, data: devices });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { getMyDevices };