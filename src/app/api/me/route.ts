import { NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    steamId:     user.steamId,
    displayName: user.displayName,
    avatarUrl:   user.avatarUrl,
    role:        user.role,
  });
}