const express = require("express");
const router = express.Router();

const authMiddleware = require("../Middleware/authMiddleware");

// All command sending is handled via Socket.IO directly
// This route exists for REST-based command status checks

router.get("/", authMiddleware, (req, res) => {
    res.json({
        success: true,
        message: "Commands are handled via Socket.IO",
    });
});

module.exports = router;