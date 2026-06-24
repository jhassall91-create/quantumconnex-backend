const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
    name:         { type: String },
    type:         { type: String, enum: ["direct", "group"], default: "direct" },
    participants: [{ 
        userId:   String, 
        name:     String, 
        deviceId: String,
        joinedAt: { type: Date, default: Date.now },
    }],
    lastMessage:  {
        content:   String,
        senderId:  String,
        senderName: String,
        timestamp: Date,
    },
    createdBy:    { type: String, required: true },
    avatar:       { type: String },
    isFamily:     { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Conversation", conversationSchema);