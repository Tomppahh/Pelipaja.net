import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";
import { createServer } from "@/src/backend/services/gameServerService";
import { ROLES, hasRole } from "@/src/lib/config/settings";
import { log } from "@/src/backend/lib/logger";

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

  if (!gameType || !gameConfig?.map) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Create match as pending
  const match = await Match.create({
    gameType,
    gameConfig: {
      ...gameConfig,
      ownerName: user.displayName || user.steamId || "Unknown",
    },
    playersPerTeam,
    status: "pending",
  });

  try {
    // Spin up server
    const server = await createServer(gameType, gameConfig.map, match._id.toString());

    // Update match with server info
    match.status = "live";
    match.connectionIp = server.connectionIp;
    match.connectionPort = server.connectionPort;
    await match.save();

    console.log(
      `Match ${match._id} created with map ${gameConfig.map} by user ${user.displayName} on server ${server.gameId}`
    );
    log(`${user.displayName} created server ${gameId} with map ${input.gameConfig.map}`);
    
    return NextResponse.json({ matchId: match._id }, { status: 201 });
  } catch (err) {
    console.error("Failed to create server:", err);
    match.status = "cancelled";
    await match.save();
    return NextResponse.json({ error: "Failed to start server" }, { status: 500 });
  }
}