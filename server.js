const express  = require("express");
const cors     = require("cors");
const dotenv   = require("dotenv");
const http     = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

dotenv.config();

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket"],
});

app.use(cors());
app.use(express.json());

const recoveryRoutes  = require("./routes/recovery");
const authRoutes      = require("./routes/authRoutes");
const deviceRoutes    = require("./routes/deviceRoutes");
const commandRoutes   = require("./routes/commandRoutes");
const pairingRoutes   = require("./routes/pairingRoutes");
const networkRoutes   = require("./routes/networkRoutes");
const chatRoutes      = require("./routes/chatRoutes");
const locationRoutes  = require("./routes/locationRoutes");

app.get("/", (req, res) => {
    res.json({ status: "online", service: "QuantumConnex Backend", version: "2.0.0" });
});

app.use("/api/recovery",  recoveryRoutes);
app.use("/api/auth",      authRoutes);
app.use("/api/devices",   deviceRoutes);
app.use("/api/commands",  commandRoutes);
app.use("/api/pairing",   pairingRoutes);
app.use("/api/network",   networkRoutes);
app.use("/api/chat",      chatRoutes);
app.use("/api/locations", locationRoutes);

const { setIO } = require("./services/deviceControlLayer");
setIO(io);

const socketHandler = require("./socket/index");
socketHandler(io);

const PORT = process.env.PORT || 5000;

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected");
        server.listen(PORT, () => {
            console.log(`QuantumConnex running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection failed:", err.message);
        process.exit(1);
    });