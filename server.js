require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

require("./database");

const Device = require("./models/Device");
const User = require("/models/User");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
});

const PORT = 5000;
const JWT_SECRET = "quantum_secret_key";

/* SOCKET */
io.on("connection", () => {
  console.log("client connected");
});

/* AUTH MIDDLEWARE */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token" });

  const token = header.split(" ")[1];

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/* ADMIN MIDDLEWARE */
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
}

/* SEED */
async function seed() {
  const count = await Device.countDocuments();
  if (count === 0) {
    await Device.insertMany([
      { name: "Samsung Galaxy S24", type: "Android", status: "Connected" },
      { name: "MacBook Pro", type: "macOS", status: "Available" },
      { name: "iPhone 15", type: "iOS", status: "Disconnected" },
    ]);
  }
}
seed();

/* DEVICES */
app.get("/devices", authMiddleware, async (req, res) => {
  const devices = await Device.find();
  res.json(devices);
});

app.post("/devices", authMiddleware, adminOnly, async (req, res) => {
  await Device.create(req.body);
  const devices = await Device.find();
  io.emit("devicesUpdated", devices);
  res.json(devices);
});

app.delete("/devices/:id", authMiddleware, adminOnly, async (req, res) => {
  await Device.findByIdAndDelete(req.params.id);
  const devices = await Device.find();
  io.emit("devicesUpdated", devices);
  res.json(devices);
});

app.put("/devices/:id/toggle", authMiddleware, adminOnly, async (req, res) => {
  const device = await Device.findById(req.params.id);
  if (!device) return res.status(404).json({ message: "Not found" });

  device.status =
    device.status === "Connected" ? "Disconnected" : "Connected";

  await device.save();

  const devices = await Device.find();
  io.emit("devicesUpdated", devices);

  res.json(devices);
});

/* AUTH */
app.post("/register", async (req, res) => {
  const hashed = await bcrypt.hash(req.body.password, 10);

  const user = await User.create({
    email: req.body.email,
    password: hashed,
    role: "user",
  });

  res.json(user);
});

app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user)
    return res.status(400).json({ message: "User not found" });

  const match = await bcrypt.compare(req.body.password, user.password);

  if (!match)
    return res.status(400).json({ message: "Wrong password" });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token, user });
});

/* ADMIN PROMOTE */
app.post("/make-admin", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) return res.status(404).json({ message: "Not found" });

  user.role = "admin";
  await user.save();

  res.json(user);
});

server.listen(PORT, () => {
  console.log("running on http://localhost:" + PORT);
});