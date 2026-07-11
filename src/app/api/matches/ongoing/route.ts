import { NextResponse } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import Match from "@/src/models/Match";
import Lobby from "@/src/models/lobby";

export async function GET() {
  await connectDB();

  const matches = await Match.find({ status: { $in: ["configuring", "ready", "live"] } })
    .sort({ createdAt: -1 })
    .lean();

  const matchIds = matches.map((m) => m._id);
  const lobbies = await Lobby.find({ matchId: { $in: matchIds }, "settings.isPublic": true })
    .select("matchId settings.name settings.mode settings.teamSize settings.workshopMapName players")
    .lean();

  const publicLobbyByMatch = new Map(lobbies.map((l) => [l.matchId.toString(), l]));

  const ongoing = matches
    .filter((m) => publicLobbyByMatch.has(m._id.toString()))
    .map((m) => {
      const lobby = publicLobbyByMatch.get(m._id.toString());
      const gc = (m.gameConfig ?? {}) as Record<string, unknown>;
      const playerCount = lobby?.players?.length ?? m.playersPerTeam * 2;
      const capacity = lobby?.settings.teamSize ?? m.playersPerTeam;

      return {
        matchId: m._id.toString(),
        status: m.status,
        map: lobby?.settings.workshopMapName ?? gc.map ?? "TBD",
        mode: lobby?.settings.mode ?? "unknown",
        name: lobby?.settings.name ?? "Match",
        teamSize: capacity,
        playerCount,
        capacity: capacity * 2,
        createdAt: m.createdAt,
      };
    });

  return NextResponse.json({ ongoing });
}
