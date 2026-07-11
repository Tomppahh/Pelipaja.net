// src/app/api/matches/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import Match from "@/src/models/Match";
import MatchResult from "@/src/models/MatchResult";
import Lobby from "@/src/models/lobby";
import { destroyServer } from "@/src/backend/services/gameServerService";
import { broadcastMatchUpdate } from "@/src/backend/services/sse";

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
    return NextResponse.json({ error: "Invalid API secret." }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const { status, stats } = body;

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const match = await Match.findByIdAndUpdate(id, { status }, { new: true });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Push status change to lobby SSE subscribers
  const lobby = await Lobby.findOne({ matchId: id });
  broadcastMatchUpdate(id, {
    status,
    connectionIp: match.connectionIp,
    connectionPort: match.connectionPort,
    map: (match.gameConfig as Record<string, unknown>)?.map,
  });

  try {
    if (status === "configuring") {
      const lobby = await Lobby.findOne({ matchId: id });

      // Solo test matches have no lobby — config was already sent directly, skip.
      if (!lobby) {
        return NextResponse.json({ ok: true });
      }

      const team1Players = (lobby?.players ?? [])
        .filter(p => p.team === "team1")
        .map(p => p.steamId);

      const team2Players = (lobby?.players ?? [])
        .filter(p => p.team === "team2")
        .map(p => p.steamId);

      const gameConfigMap = (match.gameConfig as Record<string, unknown>).map as string | undefined;
      const gameConfigMode = (match.gameConfig as Record<string, unknown>).mode as string | undefined;

      const map =
        lobby?.mapVetoState?.remainingMaps[0] ??
        lobby?.settings.mapPool?.[0] ??
        gameConfigMap ??
        "de_mirage";

      const workshopId = lobby?.settings.workshopMapId ?? undefined;

      const mapName = workshopId
        ? (lobby?.settings.workshopMapName ?? map)
        : map;

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
          map: mapName,
          workshopId,
          teamSize: lobby?.settings.teamSize ?? match.playersPerTeam,
          team1: { name: "Team 1", players: team1Players },
          team2: { name: "Team 2", players: team2Players },
        }),
        signal: AbortSignal.timeout(10000),
      });
    }

    if (status === "finished" || status === "cancelled") {
      if (match.gameId) {
        const lobby = await Lobby.findOne({ matchId: id });
        const workshopId = lobby?.settings.workshopMapId;
        await destroyServer(match.gameId, workshopId ? [workshopId] : undefined);
      }
    }

    // Save match result with stats when match finishes
    if (status === "finished" && stats?.players) {
      const lobby = await Lobby.findOne({ matchId: id });
      const gc = (match.gameConfig ?? {}) as Record<string, unknown>;
      const team1Players = (lobby?.players ?? []).filter(p => p.team === "team1").map(p => p.steamId);
      const team2Players = (lobby?.players ?? []).filter(p => p.team === "team2").map(p => p.steamId);

      const team1StatsList = stats.players.filter((p: { steamId: string }) => team1Players.includes(p.steamId));
      const team2StatsList = stats.players.filter((p: { steamId: string }) => team2Players.includes(p.steamId));

      await MatchResult.create({
        matchId: id,
        map: stats.map ?? gc.map as string,
        isPublic: lobby?.settings.isPublic ?? false,
        score: stats.score ?? { ct: 0, t: 0 },
        duration: Math.floor((Date.now() - match.createdAt.getTime()) / 1000),
        team1: {
          name: "Team 1",
          score: stats.score?.ct ?? 0,
          players: team1StatsList,
        },
        team2: {
          name: "Team 2",
          score: stats.score?.t ?? 0,
          players: team2StatsList,
        },
      });
    }
  } catch (err) {
    console.error(`Failed to handle status ${status} for match ${id}:`, err);
  }

  return NextResponse.json({ ok: true });
}