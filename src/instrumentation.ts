export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("connecting to DB...");
    const { connectDB } = await import("@/src/backend/lib/db");
    await connectDB();
    console.log("DB connected");
  }
}
