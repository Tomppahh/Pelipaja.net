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
  const port = match.connectionPort ?? 27015;
  const gameId = gameConfig.gameId ?? `cs${port - 27014}`;
  const { destroyServer } = await import("@/src/backend/services/gameServerService");
  await destroyServer("cs2", gameId);

  match.status = "cancelled";
  await match.save();

  return NextResponse.json({ message: "Server stopped" });
}