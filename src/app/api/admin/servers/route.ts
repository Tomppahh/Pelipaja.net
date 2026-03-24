import { NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { connectDB } = await import("@/src/backend/lib/db");
  await connectDB();
  const matches = await Match.find({
    status: { $in: ["pending", "configuring","ready", "live"] }
  }).sort({ createdAt: -1 });

  return NextResponse.json(matches);
}