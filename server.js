import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import User from "./models/User.js";
import Device from "./models/Device.js";

dotenv.config();

const app = express();

// =======================
// MIDDLEWARE
// =======================
app.use(cors());
app.use(express.json());

// =======================
// HEALTH / ROOT ROUTES
// =======================

app.get("/", (req, res) => {
  res.send("QuantumConnex Backend Running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "QuantumConnex API" });
});

// =======================
// DATABASE CONNECTION
// =======================

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB error:", err));

// =======================
// USERS API (CRUD)
// =======================

// CREATE user
app.post("/api/users", async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// DEVICES API (CRUD)
// =======================

// CREATE device
app.post("/api/devices", async (req, res) => {
  try {
    const device = await Device.create(req.body);
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET devices
app.get("/api/devices", async (req, res) => {
  try {
    const devices = await Device.find();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// SERVER START
// =======================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});