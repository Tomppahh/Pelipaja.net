import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";
import { getMatchView } from "@/src/backend/lobby/matchView";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "You must be logged in to view match details." }, { status: 401 });

  const view = await getMatchView(id, user);
  if (!view) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(view);
}