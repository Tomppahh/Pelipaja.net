import type { PlayerMatchStats } from "@/src/lib/types/match";

export function num(n: number | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/**
 * Approximate HLTV Rating 2.0 using the reverse-engineered formula:
 * 0.0073*KAST + 0.3591*KPR + -0.5329*DPR + 0.2372*Impact + 0.0032*ADR + 0.1587
 *
 * KAST is approximated as: (rounds with kill OR assist) / totalRounds
 * (We can't track survived/traded without per-round data)
 * Impact ≈ 2.13*KPR + 0.42*APR - 0.41
 */
export function calculateHLTVRating(
  player: PlayerMatchStats,
  totalRounds: number,
): number {
  if (totalRounds <= 0) return 0;

  const kills = num(player.kills);
  const deaths = num(player.deaths);
  const assists = num(player.assists);

  const kpr = kills / totalRounds;
  const dpr = deaths / totalRounds;
  const apr = assists / totalRounds;
  const adr = num(player.totalDamage) / totalRounds;

  // Approximate KAST — rounds where player got a kill or assist
  // (real KAST also includes survived + traded, so this underestimates)
  const kast = Math.min(((kills + assists) / totalRounds) * 100, 100);

  // Impact from multi-kills, opening kills, clutches
  const impact = 2.13 * kpr + 0.42 * apr - 0.41;

  const rating =
    0.0073 * kast +
    0.3591 * kpr +
    -0.5329 * dpr +
    0.2372 * impact +
    0.0032 * adr +
    0.1587;

  return Math.round(rating * 100) / 100;
}

export function calculateHSPercent(player: PlayerMatchStats): number {
  const kills = num(player.kills);
  if (kills === 0) return 0;
  return Math.round((num(player.headshotKills) / kills) * 100);
}

export function calculateEntryPercent(player: PlayerMatchStats): number {
  const total = num(player.entryKills) + num(player.entryDeaths);
  if (total === 0) return 0;
  return Math.round((num(player.entryKills) / total) * 100);
}

export function calculateClutchWinPercent(player: PlayerMatchStats): number {
  const total = num(player.oneVoneCount);
  if (total === 0) return 0;
  return Math.round((num(player.oneVoneWins) / total) * 100);
}

export type Bracket = "5v5" | "aim";

export function classifyBracket(
  playersPerTeam: number,
  mapName: string,
): Bracket | null {
  if (mapName.startsWith("aim_")) return "aim";
  if (playersPerTeam >= 5) return "5v5";
  // 2v2–4v4 excluded
  return null;
}

export interface PlayerMatchRow {
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
}

export interface PlayerSummary {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKD: number;
  avgHSPercent: number;
  avgADR: number;
  avgRating: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
}

export function computeMatchRow(
  player: PlayerMatchStats,
  teamScore: number,
  opponentScore: number,
  matchId: string,
  map: string,
  duration: number,
  date: Date,
): PlayerMatchRow {
  const kills = num(player.kills);
  const deaths = num(player.deaths);
  const assists = num(player.assists);
  const totalRounds = teamScore + opponentScore;

  return {
    matchId: String(matchId),
    map,
    result: teamScore > opponentScore ? "W" : "L",
    score: `${teamScore}-${opponentScore}`,
    kills,
    deaths,
    assists,
    kd: deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : kills,
    hsPercent: calculateHSPercent(player),
    adr: totalRounds > 0 ? Math.round(num(player.totalDamage) / totalRounds) : 0,
    rating: calculateHLTVRating(player, totalRounds),
    duration,
    date: date.toISOString(),
  };
}

export function computeSummary(rows: PlayerMatchRow[]): PlayerSummary {
  const n = rows.length;
  if (n === 0) {
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
  }

  const wins = rows.filter((r) => r.result === "W").length;
  const totalKills = rows.reduce((s, r) => s + r.kills, 0);
  const totalDeaths = rows.reduce((s, r) => s + r.deaths, 0);
  const totalAssists = rows.reduce((s, r) => s + r.assists, 0);

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
    totalAssists,
  };
}
