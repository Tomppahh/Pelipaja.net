import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";
import Lobby from "@/src/models/lobby";
import { connectDB } from "@/src/backend/lib/db";
import { destroyServer } from "@/src/backend/services/gameServerService";
import { broadcastLobbyUpdate } from "@/src/backend/services/sse";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const user = await getSession();

  if (!user) return NextResponse.json({ error: 'You must be logged in to cancel a match.' }, { status: 401 });

  const match = await Match.findById(id);
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lobby = await Lobby.findOne({ matchId: id });

  const ownerSteamId = (match.gameConfig as Record<string, unknown>)?.ownerSteamID;
  const isOwner = user.steamId && ownerSteamId === user.steamId;
  const isAdmin = user.role === 'admin';
  const isLeader = lobby?.leaderId === user.steamId;

  if (!(isAdmin || isLeader || (!lobby && isOwner))) {
    return NextResponse.json({ error: 'Only the lobby leader, match owner, or an admin can cancel this match.' }, { status: 403 });
  }

  try {
    match.status = 'cancelled';
    await match.save();

    if (match.gameId) {
      const workshopId = lobby?.settings.workshopMapId;
      try { await destroyServer(match.gameId, workshopId ? [workshopId] : undefined); } catch (err) { console.error('Failed to destroy server on cancel:', err); }
    }

    if (lobby) {
      await Lobby.deleteOne({ matchId: id });
      broadcastLobbyUpdate(id, { closed: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to cancel match:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
