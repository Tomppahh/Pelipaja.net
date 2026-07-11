import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";
import MatchResult from "@/src/models/MatchResult";
import Lobby from "@/src/models/lobby";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "You must be logged in to view match stats." }, { status: 401 });

  await connectDB();
  const { id } = await params;

  const match = await Match.findById(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const lobby = await Lobby.findOne({ matchId: id }).lean();

  // Get team names from lobby captains
  function getTeamName(team: "team1" | "team2"): string {
    if (!lobby) return team === "team1" ? "Team 1" : "Team 2";
    const captain = lobby.players.find(p => p.team === team && p.isCaptain);
    if (captain) {
      const otherTeam = team === "team1" ? "team2" : "team1";
      const otherCaptain = lobby.players.find(p => p.team === otherTeam && p.isCaptain);
      if (otherCaptain) {
        return `${captain.displayName} (${team === "team1" ? "CT" : "T"})`;
      }
      return captain.displayName;
    }
    return team === "team1" ? "Team 1" : "Team 2";
  }

  // For finished matches, return from database
  if (match.status === "finished" || match.status === "cancelled") {
    const result = await MatchResult.findOne({ matchId: id }).lean();
    return NextResponse.json({
      status: match.status,
      source: "database",
      data: result ? {
        ...result,
        team1: { ...result.team1, name: getTeamName("team1") },
        team2: { ...result.team2, name: getTeamName("team2") },
      } : null,
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
        data: {
          ...stats,
          team1Name: getTeamName("team1"),
          team2Name: getTeamName("team2"),
        },
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
