import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";
import Lobby from "@/src/models/lobby";
import { ROLES, hasRole } from "@/src/lib/config/settings";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";

const VALID_GAME_TYPES = ["cs2"] as const;
const VALID_LOBBY_MODES = ["use_current_teams", "captain_pick", "captain_map_veto", "pick_map"] as const;

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(user.role, ROLES.lobby)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();

  const body = await req.json();
  const { gameType, lobbyMode, teamSize, playersPerTeam, gameConfig } = body;
  const isLegacyCs2 = gameConfig != null;
  const resolvedTeamSize = typeof teamSize === "number" ? teamSize : playersPerTeam;

  if (!VALID_GAME_TYPES.includes(gameType)) {
    return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
  }
  if (!isLegacyCs2 && !VALID_LOBBY_MODES.includes(lobbyMode)) {
    return NextResponse.json({ error: "Invalid lobby mode" }, { status: 400 });
  }
  if (typeof resolvedTeamSize !== "number" || resolvedTeamSize < 1 || resolvedTeamSize > 10) {
    return NextResponse.json({ error: "teamSize must be between 1 and 10" }, { status: 400 });
  }

  const existingLobby = await Lobby.findOne({ "players.steamId": user.steamId }).select("matchId");
  if (existingLobby) {
    return NextResponse.json(
      { error: "You are already in a lobby.", matchId: existingLobby.matchId.toString() },
      { status: 409 }
    );
  }

  // One active match per non-admin user
  if (user.role !== "admin") {
    const existing = await Match.findOne({
      "gameConfig.ownerSteamID": user.steamId,
      status: { $in: ["pending", "configuring", "ready", "live"] },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You already have an active match. End it before creating a new one." },
        { status: 429 }
      );
    }
  }

  const match = await Match.create({
    gameType,
    gameConfig: isLegacyCs2
      ? {
          ...(gameConfig as Record<string, unknown>),
          ownerName: user.displayName ?? user.steamId,
          ownerSteamID: user.steamId,
        }
      : {
          ownerName: user.displayName ?? user.steamId,
          ownerSteamID: user.steamId,
        },
    playersPerTeam: resolvedTeamSize,
    status: "pending",
  });

  if (isLegacyCs2) {
    const { createServer } = await import("@/src/backend/services/gameServerService");
    const map = typeof gameConfig?.map === "string" ? gameConfig.map : CS2_MAPS[0];

    try {
      const server = await createServer(gameType, map, match._id.toString());
      match.status = "configuring";
      match.gameId = server.gameId;
      match.apiPort = server.apiPort;
      match.connectionIp = server.connectionIp;
      match.connectionPort = server.connectionPort;
      await match.save();

      return NextResponse.json({ matchId: match._id }, { status: 201 });
    } catch (error) {
      match.status = "cancelled";
      await match.save();
      console.error("Failed to start legacy match:", error);
      return NextResponse.json({ error: "Failed to start match" }, { status: 500 });
    }
  }

  // Creator is added to the lobby immediately so they don't need to "join" on page load
  await Lobby.create({
    matchId: match._id,
    leaderId: user.steamId,
    settings: {
      teamSize: resolvedTeamSize,
      mode: lobbyMode,
      mapPool: CS2_MAPS,
    },
    players: [{
      steamId: user.steamId,
      displayName: user.displayName ?? user.steamId,
      avatarUrl: user.avatarUrl,
      team: "none",
      isCaptain: false,
      isReady: false,
    }],
  });

  return NextResponse.json({ matchId: match._id }, { status: 201 });
}