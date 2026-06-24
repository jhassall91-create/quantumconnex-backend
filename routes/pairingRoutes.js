const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const {
    createPairingRequest,
    verifyPairingCode,
} = require("../services/pairingService");

// CREATE PAIRING CODE
router.post("/create", auth, async (req, res) => {
    try {
        const { deviceId, platform } = req.body;

        const request =
            await createPairingRequest(
                req.user.id,
                deviceId,
                platform
            );

        res.json({
            success: true,
            data: request,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

// VERIFY PAIRING CODE
router.post("/verify", auth, async (req, res) => {
    try {
        const { code } = req.body;

        const result =
            await verifyPairingCode(
                req.user.id,
                code
            );

        res.json(result);
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

module.exports = router;