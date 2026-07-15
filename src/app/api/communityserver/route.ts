import { queryGameServerInfo, queryGameServerPlayer } from "steam-server-query";
import { NextResponse } from "next/server";

const SERVER_ADDRESS = "204.168.157.120:27100";
const CACHE_TTL_MS = 30_000;

let cached: { data: CommunityServerResponse; ts: number } | null = null;

export interface CommunityServerResponse {
  online: boolean;
  name?: string;
  map?: string;
  players?: number;
  maxPlayers?: number;
  playerList?: { name: string; score: number; duration: number }[];
  ping?: number;
}

export async function GET() {
  try {
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const start = Date.now();
    const [info, playerData] = await Promise.all([
      queryGameServerInfo(SERVER_ADDRESS, 2, [2000, 3000]),
      queryGameServerPlayer(SERVER_ADDRESS, 2, [2000, 3000]),
    ]);
    const ping = Date.now() - start;

    const result: CommunityServerResponse = {
      online: true,
      name: info.name,
      map: info.map,
      players: info.players,
      maxPlayers: info.maxPlayers,
      playerList: playerData.players.map((p) => ({
        name: p.name,
        score: p.score,
        duration: p.duration,
      })),
      ping,
    };

    cached = { data: result, ts: Date.now() };
    return NextResponse.json(result);
  } catch {
    const result: CommunityServerResponse = { online: false };
    cached = { data: result, ts: Date.now() };
    return NextResponse.json(result);
  }
}
