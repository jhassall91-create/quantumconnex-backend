import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

// =======================
// Middleware
// =======================
app.use(cors());
app.use(express.json());

// =======================
// ROUTES
// =======================

// Root route (fixes "Not Found" on /)
app.get("/", (req, res) => {
  res.status(200).send("QuantumConnex Backend Running");
});

// Health check route (useful for Render monitoring)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "QuantumConnex API" });
});

// Devices route
app.get("/api/devices", (req, res) => {
  res.json({
    success: true,
    message: "Devices endpoint working",
    data: []
  });
});

// Users route
app.get("/api/users", (req, res) => {
  res.json({
    success: true,
    message: "Users endpoint working",
    data: []
  });
});

// =======================
// DATABASE CONNECTION
// =======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB error:", err));

// =======================
// SERVER START
// =======================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});