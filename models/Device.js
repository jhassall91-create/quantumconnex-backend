const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  name: String,
  type: String,
  status: String,
});

module.exports = mongoose.model("Device", deviceSchema);