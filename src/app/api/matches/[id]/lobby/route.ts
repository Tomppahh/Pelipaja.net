//app/api/matches/[id]/lobby/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import { getSession } from "@/src/backend/lib/session";
import Lobby from "@/src/models/lobby";
import { lobbyActions } from "@/src/backend/lobby/actions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await connectDB();

  const lobby = await Lobby.findOne({ matchId: id });
  if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });

  return NextResponse.json(lobby);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const body = await req.json();
  const { action } = body;

  const handler = lobbyActions[action];
  if (!handler) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const lobby = await Lobby.findOne({ matchId: id });
  if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });

  return handler({ lobby, user, body, matchId: id });
}