const express      = require("express");
const router       = express.Router();
const auth         = require("../Middleware/authMiddleware");
const Message      = require("../models/Message");
const Conversation = require("../models/Conversation");

// ── Get all conversations for user ───────────────────────────────────────────
router.get("/conversations", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const convos = await Conversation.find({
            "participants.userId": userId,
        }).sort({ updatedAt: -1 });
        res.json({ success: true, data: convos });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Create conversation ───────────────────────────────────────────────────────
router.post("/conversations", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, type, participants } = req.body;

        // For direct messages check if convo already exists
        if (type === "direct" && participants.length === 2) {
            const existing = await Conversation.findOne({
                type: "direct",
                "participants.userId": { $all: participants.map(p => p.userId) },
            });
            if (existing) return res.json({ success: true, data: existing });
        }

        const convo = await Conversation.create({
            name:         name || null,
            type:         type || "direct",
            participants: participants.map(p => ({ ...p, joinedAt: new Date() })),
            createdBy:    userId,
        });

        res.json({ success: true, data: convo });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Get messages for conversation ─────────────────────────────────────────────
router.get("/conversations/:id/messages", auth, async (req, res) => {
    try {
        const { limit = 50, before } = req.query;
        const query = { conversationId: req.params.id, deleted: false };
        if (before) query.createdAt = { $lt: new Date(before) };

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({ success: true, data: messages.reverse() });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Send message ──────────────────────────────────────────────────────────────
router.post("/conversations/:id/messages", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { content, type, senderName, senderDevice, mediaUrl } = req.body;

        const msg = await Message.create({
            conversationId: req.params.id,
            senderId:       userId,
            senderName:     senderName || "Unknown",
            senderDevice:   senderDevice || null,
            content,
            type:           type || "text",
            mediaUrl:       mediaUrl || null,
        });

        // Update conversation last message
        await Conversation.findByIdAndUpdate(req.params.id, {
            lastMessage: {
                content:    content,
                senderId:   userId,
                senderName: senderName || "Unknown",
                timestamp:  new Date(),
            },
            updatedAt: new Date(),
        });

        res.json({ success: true, data: msg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Mark messages as read ─────────────────────────────────────────────────────
router.post("/conversations/:id/read", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        await Message.updateMany(
            { conversationId: req.params.id, "readBy.userId": { $ne: userId } },
            { $push: { readBy: { userId, readAt: new Date() } } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Get users to chat with (all users) ───────────────────────────────────────
router.get("/users", auth, async (req, res) => {
    try {
        const User = require("../models/User");
        const users = await User.find({ _id: { $ne: req.user.id } })
            .select("_id email name")
            .limit(50);
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;