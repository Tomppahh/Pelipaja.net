import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import MatchResult from "@/src/models/MatchResult";

const MAX_RESULTS = 50;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ steamId: string }> },
) {
  const { steamId } = await params;
  if (!steamId || !/^\d{17}$/.test(steamId)) {
    return NextResponse.json({ error: "Invalid steamId" }, { status: 400 });
  }

  await connectDB();

  const results = await MatchResult.aggregate([
    { $match: { $or: [{ "team1.players.steamId": steamId }, { "team2.players.steamId": steamId }] } },
    { $sort: { createdAt: -1 } },
    { $limit: MAX_RESULTS },
    {
      $lookup: {
        from: "matches",
        localField: "matchId",
        foreignField: "_id",
        as: "match",
        pipeline: [{ $project: { playersPerTeam: 1 } }],
      },
    },
    { $unwind: { path: "$match", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        matchId: 1,
        map: 1,
        duration: 1,
        createdAt: 1,
        "team1.name": 1,
        "team1.score": 1,
        "team2.name": 1,
        "team2.score": 1,
        "team1.players": 1,
        "team2.players": 1,
        playersPerTeam: "$match.playersPerTeam",
      },
    },
  ]);

  interface AggPlayer {
    steamId: string;
    name: string;
    team: string;
    kills: number;
    deaths: number;
    assists: number;
    headshotKills: number;
    utilityDamage: number;
    flashAssists: number;
    shotsFired: number;
    shotsOnTarget: number;
    totalDamage: number;
    entryKills: number;
    entryDeaths: number;
    entryCount: number;
    oneVoneCount: number;
    oneVoneWins: number;
    score: number;
    mvs: number;
    ping: number;
  }

  interface AggResult {
    _id: unknown;
    matchId: unknown;
    map: string;
    duration: number;
    createdAt: Date;
    team1: { name: string; score: number; players: AggPlayer[] };
    team2: { name: string; score: number; players: AggPlayer[] };
    playersPerTeam?: number;
  }

  const fiveVfive: {
    matchId: string;
    map: string;
    result: "W" | "L";
    score: string;
    kills: number;
    deaths: number;
    assists: number;
    kd: number;
    hsPercent: number;
    adr: number;
    rating: number;
    duration: number;
    date: string;
    myTeam: string;
  }[] = [];

  const aim: typeof fiveVfive = [];

  for (const r of results as AggResult[]) {
    const ppt = r.playersPerTeam ?? 5;
    const isAim = r.map.startsWith("aim_");
    if (!isAim && ppt < 5) continue;

    const player =
      r.team1.players.find((p) => p.steamId === steamId) ??
      r.team2.players.find((p) => p.steamId === steamId);
    if (!player) continue;

    const teamScore =
      player.team === r.team1.name ? r.team1.score : r.team2.score;
    const opponentScore =
      player.team === r.team1.name ? r.team2.score : r.team1.score;
    const totalRounds = teamScore + opponentScore;

    const kills = player.kills ?? 0;
    const deaths = player.deaths ?? 0;
    const assists = player.assists ?? 0;
    const hsPercent = kills > 0 ? Math.round(((player.headshotKills ?? 0) / kills) * 100) : 0;
    const adr = totalRounds > 0 ? Math.round((player.totalDamage ?? 0) / totalRounds) : 0;

    // Approximate HLTV Rating 2.0
    const kpr = totalRounds > 0 ? kills / totalRounds : 0;
    const dpr = totalRounds > 0 ? deaths / totalRounds : 0;
    const apr = totalRounds > 0 ? assists / totalRounds : 0;
    const kast = Math.min(((kills + assists) / Math.max(totalRounds, 1)) * 100, 100);
    const impact = 2.13 * kpr + 0.42 * apr - 0.41;
    const rating =
      Math.round(
        (0.0073 * kast + 0.3591 * kpr - 0.5329 * dpr + 0.2372 * impact + 0.0032 * adr + 0.1587) * 100,
      ) / 100;

    const row = {
      matchId: String(r.matchId),
      map: r.map,
      result: (teamScore > opponentScore ? "W" : "L") as "W" | "L",
      score: `${teamScore}-${opponentScore}`,
      kills,
      deaths,
      assists,
      kd: deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : kills,
      hsPercent,
      adr,
      rating,
      duration: r.duration,
      date: r.createdAt.toISOString(),
      myTeam: player.team,
    };

    if (isAim) {
      aim.push(row);
    } else {
      fiveVfive.push(row);
    }
  }

  const fiveVfive10 = fiveVfive.slice(0, 10);
  const aim10 = aim.slice(0, 10);

  function summarize(rows: typeof fiveVfive) {
    const n = rows.length;
    if (n === 0)
      return {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgKD: 0,
        avgHSPercent: 0,
        avgADR: 0,
        avgRating: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
      };
    const wins = rows.filter((r) => r.result === "W").length;
    const totalKills = rows.reduce((s, r) => s + r.kills, 0);
    const totalDeaths = rows.reduce((s, r) => s + r.deaths, 0);
    return {
      totalMatches: n,
      wins,
      losses: n - wins,
      winRate: Math.round((wins / n) * 1000) / 10,
      avgKD: totalDeaths > 0 ? Math.round((totalKills / totalDeaths) * 100) / 100 : totalKills,
      avgHSPercent: Math.round(rows.reduce((s, r) => s + r.hsPercent, 0) / n),
      avgADR: Math.round(rows.reduce((s, r) => s + r.adr, 0) / n),
      avgRating: Math.round((rows.reduce((s, r) => s + r.rating, 0) / n) * 100) / 100,
      totalKills,
      totalDeaths,
      totalAssists: rows.reduce((s, r) => s + r.assists, 0),
    };
  }

  return NextResponse.json({
    fiveVfive: { summary: summarize(fiveVfive10), matches: fiveVfive10 },
    aim: { summary: summarize(aim10), matches: aim10 },
  });
}
