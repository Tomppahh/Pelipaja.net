import { NextResponse } from "next/server";
import { getSession } from "@/src/backend/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json(null, { status: 200 });
  }

  return NextResponse.json(user);
}
