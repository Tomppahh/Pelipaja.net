import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import Match from "@/src/models/Match";
import MatchResult from "@/src/models/MatchResult";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;

  const match = await Match.findById(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // For finished matches, return from database
  if (match.status === "finished" || match.status === "cancelled") {
    const result = await MatchResult.findOne({ matchId: id }).lean();
    return NextResponse.json({
      status: match.status,
      source: "database",
      data: result ?? null,
    });
  }

  // For live/ready matches, proxy from the plugin's HTTP server
  if (
    (match.status === "live" || match.status === "ready") &&
    process.env.HOME_PC_WG_IP &&
    match.apiPort
  ) {
    try {
      const res = await fetch(
        `http://${process.env.HOME_PC_WG_IP}:${match.apiPort}/stats`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MATCHUP_API_SECRET}`,
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!res.ok) {
        return NextResponse.json(
          { status: match.status, source: "plugin", data: null, error: "Plugin returned error" },
          { status: 502 }
        );
      }

      const stats = await res.json();
      return NextResponse.json({
        status: match.status,
        source: "plugin",
        data: stats,
      });
    } catch {
      return NextResponse.json({
        status: match.status,
        source: "plugin",
        data: null,
        error: "Failed to reach game server",
      });
    }
  }

  // Match is in configuring/pending state, no stats yet
  return NextResponse.json({
    status: match.status,
    source: "none",
    data: null,
  });
}
