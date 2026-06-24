const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    conversationId: { type: String, required: true, index: true },
    senderId:       { type: String, required: true },
    senderName:     { type: String, required: true },
    senderDevice:   { type: String },
    content:        { type: String, default: "" },
    type:           { type: String, enum: ["text", "image", "system", "file"], default: "text" },
    mediaUrl:       { type: String },
    readBy:         [{ userId: String, readAt: Date }],
    deliveredTo:    [{ userId: String, deliveredAt: Date }],
    edited:         { type: Boolean, default: false },
    deleted:        { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);