const mongoose = require("mongoose");

const locationPointSchema = new mongoose.Schema({
    latitude:  { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy:  { type: Number, default: 0 },
    altitude:  { type: Number, default: null },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });

const deviceLocationSchema = new mongoose.Schema({
    deviceId:  { type: String, required: true, unique: true },
    userId:    { type: String, required: true },
    platform:  { type: String, default: "unknown" },
    latitude:  { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy:  { type: Number, default: 0 },
    altitude:  { type: Number, default: null },
    updatedAt: { type: Date, default: Date.now },
    history:   { type: [locationPointSchema], default: [] },
});

module.exports = mongoose.model("DeviceLocation", deviceLocationSchema);