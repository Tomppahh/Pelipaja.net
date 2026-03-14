import { NextRequest, NextResponse } from "next/server";
import { RelyingParty } from "openid";
import { connectDB } from "@/src/backend/lib/db";
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

  return new Promise<NextResponse>((resolve) => {
    relyingParty.verifyAssertion(req.url, async (err, result) => {
      if (err || !result?.authenticated || !result.claimedIdentifier) {
        resolve(NextResponse.redirect(`${process.env.AUTH_URL}/login?error=true`));
        return;
      }

      // steamId is at the end of the URL:
      // https://steamcommunity.com/openid/id/76561198000000001
      const steamId = result.claimedIdentifier.split("/").pop();
      if (!steamId) {
        resolve(NextResponse.redirect(`${process.env.AUTH_URL}/login?error=true`));
        return;
      }

      await connectDB();

      // Fetch their Steam profile (name, avatar)
      const res = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${steamId}`
      );
      const data = await res.json();
      const profile = data?.response?.players?.[0];

      // Find or create user in MongoDB
      let user = await User.findOne({ steamId });
      if (!user) {
        user = await User.create({
          steamId,
          displayName: profile?.personaname ?? "Unknown",
          avatarUrl: profile?.avatarfull ?? "",
          role: "user",
        });
      } else {
        // Update name/avatar in case they changed it on Steam
        user.displayName = profile?.personaname ?? user.displayName;
        user.avatarUrl = profile?.avatarfull ?? user.avatarUrl;
        await user.save();
      }

      // Create the session cookie
      await createSession({
        id: user._id.toString(),
        steamId: user.steamId ?? "",
        displayName: user.displayName ?? "",
        avatarUrl: user.avatarUrl ?? "",
        role: user.role,
      });

      // Send them home, they're logged in
      resolve(NextResponse.redirect(`${process.env.AUTH_URL}/`));
    });
  });
}