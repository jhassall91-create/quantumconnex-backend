import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema({
  userId: String,
  deviceName: String,
  deviceType: String,
  status: {
    type: String,
    default: "active"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Device", deviceSchema);