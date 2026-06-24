const express = require("express");
const router = express.Router();
const auth = require("../Middleware/authMiddleware");
const { redis } = require("../socket/redis-store");
const DeviceLocation = require("../models/DeviceLocation");

// ── GET /api/devices/my-devices ───────────────
router.get("/my-devices", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const keys = await redis.keys("device:*");
        const devices = [];

        for (const key of keys) {
            // Only process plain device keys — skip identity, trusted, commands
            if (!key.startsWith("device:")) continue;
            if (key.includes(":identity")) continue;
            if (key.includes(":trusted")) continue;
            if (key.includes(":commands")) continue;

            const raw = await redis.get(key);
            if (!raw) continue;

            let device;
            try { device = JSON.parse(raw); } catch { continue; }

            if (device.userId === userId) {
                const deviceId = key.replace("device:", "");
                devices.push({ deviceId, ...device });
            }
        }

        res.json({ success: true, data: devices });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/devices/locations ────────────────
router.get("/locations", auth, async (req, res) => {
    try {
        const locations = await DeviceLocation.find({ userId: req.user.id });
        res.json({ success: true, data: locations });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/devices/:deviceId/history ────────
router.get("/:deviceId/history", auth, async (req, res) => {
    try {
        const doc = await DeviceLocation.findOne({
            deviceId: req.params.deviceId,
            userId: req.user.id,
        });
        if (!doc) return res.json({ success: true, data: [] });
        res.json({ success: true, data: doc.history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;