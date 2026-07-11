import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import { connectDB } from "@/src/backend/lib/db";
import Match from "@/src/models/Match";
import { createServer } from "@/src/backend/services/gameServerService";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "You must be logged in to use this feature." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "This feature is restricted to admins." }, { status: 403 });

  await connectDB();

  const body = await req.json();
  const map = typeof body.map === "string" ? body.map : "de_mirage";
  const teamSize = typeof body.teamSize === "number" ? Math.min(10, Math.max(1, body.teamSize)) : 5;

  // Check if user is already in a lobby
  const Lobby = (await import("@/src/models/lobby")).default;
  const existingLobby = await Lobby.findOne({ "players.steamId": user.steamId }).select("matchId");
  if (existingLobby) {
    return NextResponse.json(
      { error: "You are already in a lobby", matchId: existingLobby.matchId.toString() },
      { status: 409 }
    );
  }

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

  try {
    const server = await createServer("cs2", map, match._id.toString());
    match.status = "configuring";
    match.gameId = server.gameId;
    match.apiPort = server.apiPort;
    match.connectionIp = server.connectionIp;
    match.connectionPort = server.connectionPort;
    await match.save();

    // Poll for the plugin HTTP server to come up, then send bot test config
    const pluginUrl = `http://${process.env.HOME_PC_WG_IP}:${server.apiPort}`;
    const secret = process.env.MATCHUP_API_SECRET ?? "";
    let configSent = false;

    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const configRes = await fetch(`${pluginUrl}/config`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "pelipaja",
            matchId: match._id.toString(),
            ownerSteamID: user.steamId,
            map,
            teamSize,
            knifeRound: false,
            botTestMode: true,
            botsPerTeam: teamSize,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (configRes.ok) {
          configSent = true;
          break;
        }
      } catch {
        // plugin not ready yet
      }
    }

    if (!configSent) {
      match.status = "cancelled";
      await match.save();
      return NextResponse.json({ error: "Plugin did not respond in time" }, { status: 500 });
    }

    return NextResponse.json({
      matchId: match._id.toString(),
      connectionIp: server.connectionIp,
      connectionPort: server.connectionPort,
    }, { status: 201 });
  } catch (err) {
    match.status = "cancelled";
    await match.save();
    console.error("[SoloTest] Failed:", err);
    return NextResponse.json({ error: "Failed to start server" }, { status: 500 });
  }
}
