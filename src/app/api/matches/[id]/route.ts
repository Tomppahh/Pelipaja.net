import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";
import Lobby from "@/src/models/lobby";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  const match = await Match.findById(id);

  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lobby = await Lobby.findOne({ matchId: id });
  const map = (match.gameConfig as any)?.map ?? lobby?.mapVetoState?.remainingMaps?.[0] ?? lobby?.settings.mapPool?.[0];
  const mode = (match.gameConfig as any)?.mode ?? lobby?.settings.mode;

  // Determine ownership/admin status for the current session
  const { gameType, gameConfig, playersPerTeam, status, gameId, connectionIp, connectionPort } = match;
  const isOwner = user?.steamId && (gameConfig as any)?.ownerSteamID === user.steamId;
  const isAdmin = user?.role === 'admin';
  const isLeader = user?.steamId && lobby?.leaderId === user.steamId;
  const canCancel = Boolean(isAdmin || isLeader || (!lobby && isOwner));

 
  if (isAdmin) {
    const full = (typeof (match as any).toObject === 'function') ? (match as any).toObject() : { ...match };
    return NextResponse.json({ ...full, isOwner, isAdmin, leaderId: lobby?.leaderId, canCancel });
  }

  // Non-admins get a sanitized view — include connection info and whether the
  // current user is the owner so the UI can show owner actions.
  return NextResponse.json({
    gameType,
    playersPerTeam,
    status,
    gameId,
      map,
      mode,
    connectionIp,
    connectionPort,
    isOwner,
    isAdmin,
    leaderId: lobby?.leaderId,
    canCancel,
    // apiPort, ownerSteamID intentionally omitted
  });
}