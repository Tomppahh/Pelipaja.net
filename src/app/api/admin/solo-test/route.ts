import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import { connectDB } from "@/src/backend/lib/db";
import Match from "@/src/models/Match";
import Lobby from "@/src/models/lobby";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";
import { finalizeLobbyAndStartServer } from "@/src/backend/lobby/phases";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();

  const body = await req.json();
  const map = typeof body.map === "string" && CS2_MAPS.includes(body.map) ? body.map : CS2_MAPS[0];
  const teamSize = typeof body.teamSize === "number" ? Math.min(10, Math.max(1, body.teamSize)) : 5;

  // Check if user is already in a lobby
  const existingLobby = await Lobby.findOne({ "players.steamId": user.steamId }).select("matchId");
  if (existingLobby) {
    return NextResponse.json(
      { error: "You are already in a lobby", matchId: existingLobby.matchId.toString() },
      { status: 409 }
    );
  }

  // Create match
  const match = await Match.create({
    gameType: "cs2",
    gameConfig: {
      ownerName: user.displayName ?? user.steamId,
      ownerSteamID: user.steamId,
      map,
    },
    playersPerTeam: teamSize,
    status: "pending",
  });

  // Create lobby with admin on team1 and bots filling both teams
  const now = Date.now();
  const players = [
    {
      steamId: user.steamId,
      displayName: user.displayName ?? user.steamId,
      avatarUrl: user.avatarUrl,
      team: "team1" as const,
      isCaptain: true,
      isReady: true,
    },
    ...Array.from({ length: teamSize - 1 }, (_, i) => ({
      steamId: `bot-team1-${now}-${i}`,
      displayName: `Bot ${i + 1}`,
      team: "team1" as const,
      isCaptain: false,
      isReady: true,
    })),
    ...Array.from({ length: teamSize }, (_, i) => ({
      steamId: `bot-team2-${now}-${i}`,
      displayName: `Bot ${teamSize + i + 1}`,
      team: "team2" as const,
      isCaptain: i === 0,
      isReady: true,
    })),
  ];

  const lobby = await Lobby.create({
    matchId: match._id,
    leaderId: user.steamId,
    settings: {
      teamSize,
      mode: "use_current_teams",
      mapPool: CS2_MAPS,
    },
    players,
  });

  // Start the server directly
  try {
    await finalizeLobbyAndStartServer(lobby, match._id.toString());
    return NextResponse.json({
      matchId: match._id.toString(),
      message: "Solo test match created and server starting",
    }, { status: 201 });
  } catch (err) {
    match.status = "cancelled";
    await match.save();
    await Lobby.deleteOne({ matchId: match._id });
    console.error("[SoloTest] Failed to start server:", err);
    return NextResponse.json({ error: "Failed to start server" }, { status: 500 });
  }
}
