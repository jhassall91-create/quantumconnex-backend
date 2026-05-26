const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env");
    }

    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "quantumconnex",
    });

    console.log("🟢 MongoDB Connected (Atlas)");
  } catch (error) {
    console.error("🔴 MongoDB Connection Error:");
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;