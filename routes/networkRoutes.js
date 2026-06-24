const express = require("express");
const router  = express.Router();
const auth    = require("../Middleware/authMiddleware");
const { scanNetwork, getLocalSubnet } = require("../services/networkScanner");

let scanInProgress  = false;
let lastScanResults = [];
let lastScanTime    = null;

router.get("/scan", auth, async (req, res) => {
    if (scanInProgress) {
        return res.json({
            success: false,
            message: "Scan already in progress",
            inProgress: true,
        });
    }

    scanInProgress  = true;
    lastScanResults = [];

    try {
        const results = await scanNetwork((device) => {
            lastScanResults.push(device);
        });

        lastScanTime    = new Date().toISOString();
        scanInProgress  = false;
        lastScanResults = results;

        res.json({
            success:   true,
            count:     results.length,
            subnet:    getLocalSubnet(),
            scannedAt: lastScanTime,
            devices:   results,
        });
    } catch (err) {
        scanInProgress = false;
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get("/status", auth, (req, res) => {
    res.json({
        success:      true,
        inProgress:   scanInProgress,
        lastScanTime,
        count:        lastScanResults.length,
        devices:      lastScanResults,
        subnet:       getLocalSubnet(),
    });
});

module.exports = router;