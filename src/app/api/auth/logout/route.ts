import { NextResponse } from "next/server";
import { deleteSession } from "@/src/backend/lib/session";

export async function POST() {
  await deleteSession();
  return NextResponse.redirect(`${process.env.AUTH_URL}/`);
}