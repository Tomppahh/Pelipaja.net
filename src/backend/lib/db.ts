import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";

const uri = MONGODB_URI || "mongodb://localhost:27017/pelipaja";

mongoose.connection.on("disconnected", () => {
  console.warn("[DB] MongoDB disconnected. Will reconnect on next query.");
});

mongoose.connection.on("error", (err) => {
  console.error("[DB] MongoDB connection error:", err.message);
});

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  if (!MONGODB_URI && process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI is not defined in .env file!");
  }

  await mongoose.connect(uri);
}
