import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import { connectDB } from "@/src/backend/lib/db";
import Match from "@/src/models/Match";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "You must be logged in to access the admin panel." }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "The admin panel is restricted to admins." }, { status: 403 });
  }

  await connectDB();
  const matches = await Match.find({
    status: { $in: ["configuring","ready", "live"] }
  }).sort({ createdAt: -1 });

  return NextResponse.json(matches);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "You must be logged in to create a server." }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Creating test servers is restricted to admins." }, { status: 403 });
  }

  await connectDB();

  const body = await req.json().catch(() => ({}));
  const map = typeof body.map === "string" && CS2_MAPS.includes(body.map) ? body.map : CS2_MAPS[0];
  const teamSize = typeof body.teamSize === "number" ? body.teamSize : 5;

  const match = await Match.create({
    gameType: "cs2",
    gameConfig: {
      ownerName: user.displayName ?? user.steamId,
      ownerSteamID: user.steamId,
      map,
      mode: "admin",
    },
    playersPerTeam: teamSize,
    status: "pending",
  });

  const { createServer } = await import("@/src/backend/services/gameServerService");

  try {
    const server = await createServer("cs2", map, match._id.toString());
    match.status = "configuring";
    match.gameId = server.gameId;
    match.apiPort = server.apiPort;
    match.connectionIp = server.connectionIp;
    match.connectionPort = server.connectionPort;
    await match.save();

    return NextResponse.json({
      matchId: match._id,
      gameId: server.gameId,
      connectionIp: server.connectionIp,
      connectionPort: server.connectionPort,
      apiPort: server.apiPort,
      map,
    }, { status: 201 });
  } catch (error) {
    match.status = "cancelled";
    await match.save();
    console.error("Failed to create admin server:", error);
    return NextResponse.json({ error: "Failed to start server" }, { status: 500 });
  }
}
