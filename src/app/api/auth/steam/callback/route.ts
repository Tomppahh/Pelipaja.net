import { NextRequest, NextResponse } from "next/server";
import { RelyingParty } from "openid";
import User from "@/src/models/User";
import { createSession } from "@/src/backend/lib/session";

export async function GET(req: NextRequest) {
  const relyingParty = new RelyingParty(
    `${process.env.AUTH_URL}/api/auth/steam/callback`,
    process.env.AUTH_URL!,
    true,
    false,
    []
  );

  let resolved = false;

  return new Promise<NextResponse>((resolve) => {
    relyingParty.verifyAssertion(req.url, async (err, result) => {
      if (resolved) return;

      if (err || !result?.authenticated || !result.claimedIdentifier) {
        resolved = true;
        resolve(NextResponse.redirect(`${process.env.AUTH_URL}/login?error=true`, 302));
        return;
      }

      resolved = true;

      try {
        const steamId = result.claimedIdentifier.split("/").pop();
        if (!steamId) {
          resolve(NextResponse.redirect(`${process.env.AUTH_URL}/login?error=true`, 302));
          return;
        }

        const res = await fetch(
          `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${steamId}`
        );
        console.log("steam api status:", res.status);
        console.log("steam api key exists:", !!process.env.STEAM_API_KEY);
        const text = await res.text();
        console.log("steam api response:", text.substring(0, 200));
        const data = JSON.parse(text);
        const profile = data?.response?.players?.[0];

        let user = await User.findOne({ steamId });

        if (!user) {
          user = await User.create({
            steamId,
            displayName: profile?.personaname ?? "Unknown",
            avatarUrl: profile?.avatarfull ?? "",
            role: "user",
          });
        } else {
          user.displayName = profile?.personaname ?? user.displayName;
          user.avatarUrl = profile?.avatarfull ?? user.avatarUrl;
          await user.save();
        }

        await createSession({
          id: user._id.toString(),
          steamId: user.steamId ?? "",
          displayName: user.displayName ?? "",
          avatarUrl: user.avatarUrl ?? "",
          role: user.role,
        });

        resolve(NextResponse.redirect(`${process.env.AUTH_URL}/`, 302));

      } catch (error) {
        console.error("callback error:", error);
        resolve(NextResponse.redirect(`${process.env.AUTH_URL}/login?error=true`, 302));
      }
    });
  });
}