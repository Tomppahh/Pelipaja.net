import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import Match from "@/src/models/Match";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  const match = await Match.findById(id);

  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Admins get the full document
  if (user?.role === "admin") {
    return NextResponse.json(match);
  }

  // Everyone else gets a sanitized view — no sensitive infrastructure details
  const { gameType, gameConfig, playersPerTeam, status, gameId, connectionIp, connectionPort } = match;
  return NextResponse.json({
    gameType,
    playersPerTeam,
    status,
    gameId,
    map: gameConfig?.map,
    mode: gameConfig?.mode,
    connectionIp,
    connectionPort,
    // apiPort, ownerSteamID intentionally omitted
  });
}