import { queryGameServerInfo, queryGameServerPlayer } from "steam-server-query";

const SERVER_ADDRESS = process.env.COMMUNITY_SERVER_ADDRESS;
const CACHE_TTL_MS = 30_000;

let cached: { data: CommunityServerResponse; ts: number } | null = null;
const controllers = new Set<ReadableStreamDefaultController>();

export interface CommunityServerResponse {
  online: boolean;
  name?: string;
  map?: string;
  players?: number;
  maxPlayers?: number;
  playerList?: { name: string; score: number; duration: number }[];
  ping?: number;
}

async function fetchServerData(): Promise<CommunityServerResponse> {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
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
    return result;
  } catch {
    const result: CommunityServerResponse = { online: false };
    cached = { data: result, ts: Date.now() };
    return result;
  }
}

function broadcast(data: CommunityServerResponse) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const controller of controllers) {
    try {
      controller.enqueue(new TextEncoder().encode(payload));
    } catch {
      controllers.delete(controller);
    }
  }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;

function startRefreshLoop() {
  if (refreshTimer) return;
  refreshTimer = setInterval(async () => {
    if (controllers.size === 0) {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
      return;
    }
    const data = await fetchServerData();
    broadcast(data);
  }, CACHE_TTL_MS);
}

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await fetchServerData();

  const stream = new ReadableStream({
    start(controller) {
      controllers.add(controller);
      const payload = `data: ${JSON.stringify(data)}\n\n`;
      controller.enqueue(new TextEncoder().encode(payload));
      startRefreshLoop();
    },
    cancel(controller) {
      controllers.delete(controller as ReadableStreamDefaultController);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
