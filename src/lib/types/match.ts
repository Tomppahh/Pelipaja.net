export interface PlayerMatchStats {
  steamId: string;
  name: string;
  team: "CT" | "T" | "other";
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  mvs: number;
  ping: number;
  headshotKills: number;
  utilityDamage: number;
  flashAssists: number;
  shotsFired: number;
  shotsOnTarget: number;
  totalDamage: number;
  entryKills: number;
  oneVoneCount: number;
  oneVoneWins: number;
}

export interface TeamMatchStats {
  name: string;
  score: number;
  players: PlayerMatchStats[];
}

export interface MatchStats {
  map: string;
  score: { ct: number; t: number };
  round: number;
  players: PlayerMatchStats[];
}

export interface MatchResultData {
  matchId: string;
  map: string;
  score: { ct: number; t: number };
  duration: number;
  team1: TeamMatchStats;
  team2: TeamMatchStats;
  finishedAt: Date;
}
