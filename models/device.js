const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "User",
        },

        deviceId: {
            type: String,
            required: true,
            unique: true,
        },

        name: {
            type: String,
            default: "Unnamed Device",
        },

        platform: {
            type: String,
            enum: ["android", "ios", "windows", "mac"],
            default: "unknown",
        },

        status: {
            type: String,
            enum: ["online", "offline"],
            default: "offline",
        },

        lastSeen: {
            type: Date,
            default: Date.now,
        },

        trusted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model(
    "Device",
    deviceSchema
);