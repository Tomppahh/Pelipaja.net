import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";
import { connectDB } from "@/src/backend/lib/db";
import { destroyServer } from "@/src/backend/services/gameServerService";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const user = await getSession();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const match = await Match.findById(id);
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ownerSteamId = (match.gameConfig as any)?.ownerSteamID;
  const isOwner = user.steamId && ownerSteamId === user.steamId;
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    match.status = 'cancelled';
    await match.save();

    if (match.gameId) {
      try { await destroyServer(match.gameId); } catch (err) { console.error('Failed to destroy server on cancel:', err); }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to cancel match:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
