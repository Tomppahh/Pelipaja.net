import { NextResponse } from "next/server";
import { RelyingParty } from "openid";

export async function GET() {
  const relyingParty = new RelyingParty(
    `${process.env.AUTH_URL}/api/auth/steam/callback`,
    process.env.AUTH_URL!,
    true,
    false,
    []
  );

  return new Promise<NextResponse>((resolve) => {
    relyingParty.authenticate(
      "https://steamcommunity.com/openid",
      false,
      (err, authUrl) => {
        if (err || !authUrl) {
          resolve(NextResponse.json({ error: "Steam auth failed" }, { status: 500 }));
          return;
        }
        // Send user to Steam
        resolve(NextResponse.redirect(authUrl));
      }
    );
  });
}