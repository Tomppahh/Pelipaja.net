import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";
import MatchResult from "@/src/models/MatchResult";
import Lobby from "@/src/models/lobby";
import { ROLES, hasRole } from "@/src/lib/config/settings";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";
import bcrypt from "bcrypt";

const VALID_GAME_TYPES = ["cs2"] as const;
const VALID_LOBBY_MODES = ["use_current_teams", "captain_pick", "captain_map_veto", "pick_map"] as const;
const VALID_WORKSHOP_ID = /^\d{5,20}$/;
const VALID_MAP_NAME = /^[a-zA-Z0-9_\-]{1,64}$/;

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "You must be logged in to create a match." }, { status: 401 });
  if (!hasRole(user.role, ROLES.lobby)) return NextResponse.json({ error: "Your account does not have permission to create matches." }, { status: 403 });

  await connectDB();

  const body = await req.json();
  const { gameType, lobbyMode, teamSize, playersPerTeam, gameConfig } = body;
  const isLobbyMode = lobbyMode != null && VALID_LOBBY_MODES.includes(lobbyMode);
  const resolvedTeamSize = typeof teamSize === "number" ? teamSize : playersPerTeam;

  if (!VALID_GAME_TYPES.includes(gameType)) {
    return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
  }
  if (!isLobbyMode && !gameConfig) {
    return NextResponse.json({ error: "Invalid lobby mode" }, { status: 400 });
  }
  if (typeof resolvedTeamSize !== "number" || resolvedTeamSize < 1 || resolvedTeamSize > 10) {
    return NextResponse.json({ error: "teamSize must be between 1 and 10" }, { status: 400 });
  }

  const existingLobby = await Lobby.findOne({
    "players.steamId": user.steamId,
    phase: { $nin: ["starting"] },
  }).select("matchId");
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
      status: { $in: ["configuring", "ready", "live"] },
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
    gameConfig: !isLobbyMode && gameConfig
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

  if (!isLobbyMode) {
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

  // Validate workshop fields if provided
  const rawWorkshopId = (gameConfig as Record<string, unknown>)?.workshopId as string | undefined;
  const rawMapName = (gameConfig as Record<string, unknown>)?.map as string | undefined;

  if (rawWorkshopId) {
    if (!VALID_WORKSHOP_ID.test(rawWorkshopId)) {
      return NextResponse.json({ error: "Invalid workshop ID format" }, { status: 400 });
    }
    if (!rawMapName || !VALID_MAP_NAME.test(rawMapName)) {
      return NextResponse.json({ error: "Invalid map name for workshop map" }, { status: 400 });
    }
  }

  // Creator is added to the lobby immediately so they don't need to "join" on page load
  const rawPassword = (gameConfig as Record<string, unknown>)?.password as string | undefined;
  const hashedPassword = rawPassword ? await bcrypt.hash(rawPassword, 10) : undefined;

  await Lobby.create({
    matchId: match._id,
    leaderId: user.steamId,
    settings: {
      teamSize: resolvedTeamSize,
      mode: lobbyMode,
      mapPool: CS2_MAPS,
      workshopMapId: rawWorkshopId,
      workshopMapName: rawMapName,
      isPublic: !!(gameConfig as Record<string, unknown>)?.isPublic,
      password: hashedPassword,
      name: typeof (gameConfig as Record<string, unknown>)?.name === "string"
        ? ((gameConfig as Record<string, unknown>).name as string).slice(0, 60)
        : undefined,
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

export async function GET(req: NextRequest) {
  await connectDB();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  const user = await getSession();

  // Build filter: non-admin users only see public match history
  const filter: Record<string, unknown> = {};
  if (!user || user.role !== "admin") {
    filter.isPublic = true;
  }

  const [results, total] = await Promise.all([
    MatchResult.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-team1.players -team2.players")
      .lean(),
    MatchResult.countDocuments(filter),
  ]);

  return NextResponse.json({
    matches: results,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}