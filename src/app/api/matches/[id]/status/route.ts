// src/app/api/matches/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/src/backend/lib/db";
import Match from "@/src/models/Match";
import MatchResult from "@/src/models/MatchResult";
import Lobby from "@/src/models/lobby";
import { destroyServer } from "@/src/backend/services/gameServerService";
import { broadcastMatchUpdate, broadcastLobbyUpdate } from "@/src/backend/services/sse";
import { getTeamName } from "@/src/backend/lobby/matchView";

const VALID_STATUSES = ["pending", "configuring", "ready", "live", "finished", "cancelled"];

function authorized(req: NextRequest) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const expected = process.env.MATCHUP_API_SECRET ?? "";
  if (!secret || !expected) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
  } catch {
    return false;
  }
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

  // Resolve the map name so the frontend can display it in banners.
  const lobby = await Lobby.findOne({ matchId: id });
  const resolveMap = (m: typeof match) => {
    const fromGameConfig = (m.gameConfig as Record<string, unknown>)?.map as string | undefined;
    return fromGameConfig
      ?? lobby?.settings.workshopMapName
      ?? lobby?.settings.map
      ?? lobby?.mapVetoState?.remainingMaps?.[0]
      ?? lobby?.settings.mapPool?.[0]
      ?? "de_mirage";
  };

  // Push status change to lobby SSE subscribers
  broadcastMatchUpdate(id, {
    status,
    connectionIp: match.connectionIp,
    connectionPort: match.connectionPort,
    map: resolveMap(match),
  });

  try {
    if (status === "configuring") {
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

      const map =
        lobby?.mapVetoState?.remainingMaps[0] ??
        lobby?.settings.workshopMapName ??
        lobby?.settings.map ??
        gameConfigMap ??
        lobby?.settings.mapPool?.[0] ??
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
          knifeRound: (match.gameConfig as Record<string, unknown>)?.knifeRound ?? true,
          team1: { name: "Team 1", players: team1Players },
          team2: { name: "Team 2", players: team2Players },
        }),
        signal: AbortSignal.timeout(10000),
      });
    }

    if (status === "finished" || status === "cancelled") {
      if (match.gameId) {
        const workshopId = lobby?.settings.workshopMapId;
        await destroyServer(match.gameId, workshopId ? [workshopId] : undefined);
      }

      if (status === "cancelled") {
        // Delete the lobby so all players are freed to join new ones
        if (lobby) {
          await Lobby.deleteOne({ matchId: id });
          broadcastLobbyUpdate(id, { closed: true });
        }
      } else {
        // Transition lobby out of "starting" so the lobby page stops showing
        // "Creating Server…" after the match ends.
        await Lobby.findOneAndUpdate(
          { matchId: id, phase: "starting" },
          { phase: "finished" }
        );
        broadcastLobbyUpdate(id, { phase: "finished" });
      }
    }

    // Save match result with stats when match finishes
    if (status === "finished" && stats?.players) {
      const gc = (match.gameConfig ?? {}) as Record<string, unknown>;

      // The plugin sends steamId as a number; lobby stores it as a string,
      // so match by stringified value.
      const team1SteamIds = new Set(
        (lobby?.players ?? []).filter(p => p.team === "team1").map(p => String(p.steamId))
      );
      const team2SteamIds = new Set(
        (lobby?.players ?? []).filter(p => p.team === "team2").map(p => String(p.steamId))
      );

      const team1StatsList = stats.players.filter((p: { steamId: string | number }) => team1SteamIds.has(String(p.steamId)));
      const team2StatsList = stats.players.filter((p: { steamId: string | number }) => team2SteamIds.has(String(p.steamId)));

      // Fallback: if lobby has no team assignments, split by in-game side
      if (team1StatsList.length === 0 && team2StatsList.length === 0) {
        const ct = stats.players.filter((p: { team: string }) => p.team === "CT");
        const t = stats.players.filter((p: { team: string }) => p.team === "T");
        team1StatsList.push(...ct);
        team2StatsList.push(...t);
      }

      // Attribute the final ct/t scores to the correct abstract team. team1 is
      // not necessarily CT in the first half — after a side swap the panels would
      // otherwise show the losing team as the winner. Use each team's actual
      // in-game side (from a player's `team` in the final stats) to pick the score.
      const team1Side: "CT" | "T" =
        team1StatsList[0]?.team === "T" ? "T" : "CT";
      const team2Side: "CT" | "T" =
        team2StatsList[0]?.team === "T" ? "T" : "CT";
      const team1Score =
        team1Side === "CT" ? (stats.score?.ct ?? 0) : (stats.score?.t ?? 0);
      const team2Score =
        team2Side === "CT" ? (stats.score?.ct ?? 0) : (stats.score?.t ?? 0);

      await MatchResult.create({
        matchId: id,
        map: stats.map ?? gc.map as string,
        isPublic: lobby?.settings.isPublic ?? false,
        score: stats.score ?? { ct: 0, t: 0 },
        duration: Math.floor((Date.now() - match.createdAt.getTime()) / 1000),
        team1: {
          name: getTeamName(lobby, "team1"),
          score: team1Score,
          players: team1StatsList,
        },
        team2: {
          name: getTeamName(lobby, "team2"),
          score: team2Score,
          players: team2StatsList,
        },
      });
    }
  } catch (err) {
    console.error(`Failed to handle status ${status} for match ${id}:`, err);
  }

  return NextResponse.json({ ok: true });
}