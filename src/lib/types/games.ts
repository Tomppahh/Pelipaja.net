export type GameType = "cs2" | "dota2";

export interface CS2Config {
  map: string;
  mode: string;
  knifeRound: boolean;
}

export interface Dota2Config {
  lobbyName: string;
  gameMode: string;
  serverRegion?: string;
}

export type GameConfig = CS2Config | Dota2Config;