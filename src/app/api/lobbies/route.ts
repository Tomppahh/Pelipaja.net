import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import Lobby from "@/src/models/lobby";

export async function GET(req: NextRequest) {
  await connectDB();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  const [lobbies, total] = await Promise.all([
    Lobby.find({ "settings.isPublic": true, phase: "waiting" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("matchId leaderId settings phase players createdAt")
      .lean(),
    Lobby.countDocuments({ "settings.isPublic": true, phase: "waiting" }),
  ]);

  const result = lobbies.map((lobby) => {
    const leader = lobby.players.find((p: { steamId: string }) => p.steamId === lobby.leaderId);
    const playerCount = lobby.players.length;
    const capacity = lobby.settings.teamSize * 2;

    return {
      matchId: lobby.matchId.toString(),
      name: lobby.settings.name,
      mode: lobby.settings.mode,
      teamSize: lobby.settings.teamSize,
      playerCount,
      capacity,
      hasPassword: !!lobby.settings.password,
      leaderName: leader?.displayName ?? "Unknown",
      leaderAvatar: leader?.avatarUrl,
      workshopMapName: lobby.settings.workshopMapName,
      createdAt: lobby.createdAt,
    };
  });

  return NextResponse.json({
    lobbies: result,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
