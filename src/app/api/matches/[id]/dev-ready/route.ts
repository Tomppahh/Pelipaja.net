// src/app/api/matches/[id]/dev-ready/route.ts
// Only available in development. Simulates the game server posting "ready"
// so you can test the full lobby → connect flow without a real server.
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const user = await getSession();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;

  const match = await Match.findByIdAndUpdate(
    id,
    {
      status: "ready",
      connectionIp: "204.168.157.120",
      connectionPort: 27015,
    },
    { new: true }
  );

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, match });
}