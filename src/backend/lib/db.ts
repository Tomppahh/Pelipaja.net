import mongoose from "mongoose";


const MONGODB_URI = process.env.MONGODB_URI || '';

if (process.env.NODE_ENV === 'production' && !MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env file!");
}

let isConnected = false;

export async function connectDB(): Promise<void> {
    if (isConnected) return;
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
}