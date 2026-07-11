// src/app/api/matches/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import Match from "@/src/models/Match";
import Lobby from "@/src/models/lobby";
import { destroyServer } from "@/src/backend/services/gameServerService";

const VALID_STATUSES = ["pending", "configuring", "ready", "live", "finished", "cancelled"];

function authorized(req: NextRequest) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  return secret === process.env.MATCHUP_API_SECRET;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;
  const { status } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const match = await Match.findByIdAndUpdate(id, { status }, { new: true });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  try {
    if (status === "configuring") {
      // Pull the lobby so we can send the real team rosters
      const lobby = await Lobby.findOne({ matchId: id });

      const team1Players = (lobby?.players ?? [])
        .filter(p => p.team === "team1")
        .map(p => p.steamId);

      const team2Players = (lobby?.players ?? [])
        .filter(p => p.team === "team2")
        .map(p => p.steamId);

      const map =
        lobby?.mapVetoState?.remainingMaps[0] ??
        lobby?.settings.mapPool?.[0] ??
        (match.gameConfig as Record<string, unknown>).map as string ??
        "de_mirage";

      await fetch(`http://${process.env.HOME_PC_WG_IP}:${match.apiPort}/config`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MATCHUP_API_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "pelipaja",
          matchId: match._id.toString(),
          ownerSteamID: (match.gameConfig as Record<string, unknown>).ownerSteamID,
          map,
          teamSize: lobby?.settings.teamSize ?? match.playersPerTeam,
          team1: { name: "Team 1", players: team1Players },
          team2: { name: "Team 2", players: team2Players },
        }),
        signal: AbortSignal.timeout(10000),
      });
    }

    if (status === "finished" || status === "cancelled") {
      if (match.gameId) {
        await destroyServer(match.gameId);
      }
    }
  } catch (err) {
    console.error(`Failed to handle status ${status} for match ${id}:`, err);
  }

  return NextResponse.json({ ok: true });
}