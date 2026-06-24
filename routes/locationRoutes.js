const express        = require("express");
const router         = express.Router();
const auth           = require("../Middleware/authMiddleware");
const DeviceLocation = require("../models/DeviceLocation");

// Get all device locations for this user
router.get("/", auth, async (req, res) => {
    try {
        const locations = await DeviceLocation.find({ userId: req.user.id })
            .sort({ updatedAt: -1 });
        res.json({ success: true, data: locations });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get location history for a specific device
router.get("/:deviceId", auth, async (req, res) => {
    try {
        const loc = await DeviceLocation.findOne({
            deviceId: req.params.deviceId,
            userId:   req.user.id,
        });
        if (!loc) return res.json({ success: true, data: null });
        res.json({ success: true, data: loc });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get just the history trail for a device
router.get("/:deviceId/history", auth, async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        const loc = await DeviceLocation.findOne({
            deviceId: req.params.deviceId,
            userId:   req.user.id,
        });
        if (!loc) return res.json({ success: true, data: [] });
        const history = (loc.history || []).slice(-parseInt(limit));
        res.json({ success: true, data: history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;