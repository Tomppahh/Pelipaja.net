import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const user = await getSession();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { matchId } = await params;
  const { connectDB } = await import("@/src/backend/lib/db");
  await connectDB();

  const match = await Match.findById(matchId);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const gameConfig = match.gameConfig as { gameId?: string };

  let gameId = gameConfig.gameId;
  if (!gameId) {
    if (!match.connectionPort) {
      return NextResponse.json({ error: "Missing connection port; cannot resolve server id" }, { status: 400 });
    }

    const slot = match.connectionPort - 27014;
    if (slot < 1) {
      return NextResponse.json({ error: "Invalid connection port; cannot resolve server id" }, { status: 400 });
    }

    gameId = `${match.gameType ?? "cs2"}${slot}`;
  }

  const { destroyServer } = await import("@/src/backend/services/gameServerService");
  await destroyServer(gameId);

  match.status = "cancelled";
  await match.save();

  return NextResponse.json({ message: "Server stopped" });
}