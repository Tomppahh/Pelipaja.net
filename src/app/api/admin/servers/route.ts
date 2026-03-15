import { NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import { connectDB } from "@/src/backend/lib/db";
import Match from "@/src/models/Match";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const matches = await Match.find({
    status: { $in: ["pending", "configuring", "live"] }
  }).sort({ createdAt: -1 });

  return NextResponse.json(matches);
}