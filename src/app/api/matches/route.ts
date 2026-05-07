import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";
import { createServer } from "@/src/backend/services/gameServerService";
import { ROLES, hasRole } from "@/src/lib/config/settings";
import { log } from "@/src/backend/lib/logger";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";
const VALID_GAME_TYPES = ["cs2"] as const;
const VALID_MAPS: Record<string, string[]> = {
  cs2: CS2_MAPS,
};

const MIN_PLAYERS = 1;
const MAX_PLAYERS = 10;

// Strip semicolons, newlines, and quotes from any string going near a console command
function sanitizeForCommand(value: string): string {
  return value.replace(/[;|&`'"\\$\n\r]/g, "");
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  const { lobby } = ROLES;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRole(user.role, lobby)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { gameType, gameConfig, playersPerTeam } = body;

  // --- Input validation ---
  if (!gameType || !gameConfig?.map) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!VALID_GAME_TYPES.includes(gameType)) {
    return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
  }
  if (!VALID_MAPS[gameType]?.includes(gameConfig.map)) {
    return NextResponse.json({ error: "Invalid map" }, { status: 400 });
  }
  if (
    typeof playersPerTeam !== "number" ||
    playersPerTeam < MIN_PLAYERS ||
    playersPerTeam > MAX_PLAYERS
  ) {
    return NextResponse.json(
      { error: `playersPerTeam must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}` },
      { status: 400 }
    );
  }

  // --- One active match per non-admin user ---
  if (user.role !== "admin") {
    const existingMatch = await Match.findOne({
      "gameConfig.ownerSteamID": user.steamId,
      status: { $in: ["pending", "configuring", "ready", "live"] },
    });
    if (existingMatch) {
      return NextResponse.json(
        { error: "You already have an active match. End it before creating a new one." },
        { status: 429 }
      );
    }
  }

  // Sanitize map name before it ever reaches a console command
  const safeMap = sanitizeForCommand(gameConfig.map);

  const match = await Match.create({
    gameType,
    gameConfig: {
      map: safeMap,
      mode: gameConfig.mode ?? "competitive",
      ownerName: user.displayName || user.steamId || "Unknown",
      ownerSteamID: user.steamId,
    },
    playersPerTeam,
    status: "pending",
  });

  try {
    const server = await createServer(gameType, safeMap, match._id.toString());

    match.status = "configuring";
    match.gameId = server.gameId;
    match.apiPort = server.apiPort;
    match.connectionIp = server.connectionIp;
    match.connectionPort = server.connectionPort;
    await match.save();

    log(
      `${user.displayName} created server ${server.gameId} with map ${safeMap}, Match ID: ${match._id}`
    );

    return NextResponse.json({ matchId: match._id }, { status: 201 });
  } catch (err) {
    console.error("Failed to create server:", err);
    match.status = "cancelled";
    await match.save();
    return NextResponse.json({ error: "Failed to start server" }, { status: 500 });
  }
}