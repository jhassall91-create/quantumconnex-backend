const mongoose = require("mongoose");

const COMMAND_TYPES = [
    "GET_LOCATION",
    "GET_FILES",
    "PING",
    "LOCK_DEVICE",
];

const commandSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        deviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Device",
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: COMMAND_TYPES,
        },
        payload: {
            type: Object,
            default: {},
        },
        status: {
            type: String,
            enum: ["pending", "sent", "completed", "failed"],
            default: "pending",
        },
        response: {
            type: Object,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

const Command =
    mongoose.models.Command || mongoose.model("Command", commandSchema);

Command.COMMAND_TYPES = COMMAND_TYPES;

module.exports = Command;
