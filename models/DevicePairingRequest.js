const mongoose = require("mongoose");

const pairingRequestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "User",
        },

        deviceId: {
            type: String,
            required: true,
        },

        platform: {
            type: String,
            required: true,
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },

        code: {
            type: String,
            required: true,
        },

        expiresAt: {
            type: Date,
            default: () =>
                Date.now() + 10 * 60 * 1000,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model(
    "DevicePairingRequest",
    pairingRequestSchema
);