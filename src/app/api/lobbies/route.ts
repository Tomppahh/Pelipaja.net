import { connectDB } from "@/src/backend/lib/db";
import Lobby, { LobbyPlayer } from "@/src/models/lobby";

const REFRESH_MS = 10_000;
const controllers = new Set<ReadableStreamDefaultController>();

async function fetchLobbies() {
  await connectDB();

  const filter = {
    "settings.isPublic": true,
    phase: "waiting" as const,
    players: { $ne: [] as LobbyPlayer[] },
  };

  const lobbies = await Lobby.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .select("matchId leaderId settings phase players createdAt")
    .lean();

  return lobbies.map((lobby) => {
    const leader = lobby.players.find((p: { steamId: string }) => p.steamId === lobby.leaderId);
    const playerCount = lobby.players.length;
    const capacity = lobby.settings.teamSize * 2;

    return {
      matchId: lobby.matchId.toString(),
      name: lobby.settings.name,
      mode: lobby.settings.mode,
      teamSize: lobby.settings.teamSize,
      playerCount,
      capacity,
      hasPassword: !!lobby.settings.password,
      leaderName: leader?.displayName ?? "Unknown",
      leaderAvatar: leader?.avatarUrl,
      workshopMapName: lobby.settings.workshopMapName,
      createdAt: lobby.createdAt,
    };
  });
}

function broadcast(data: unknown) {
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
    try {
      const lobbies = await fetchLobbies();
      broadcast({ lobbies });
    } catch (err) {
      console.error("Lobbies SSE refresh failed:", err);
    }
  }, REFRESH_MS);
}

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controllers.add(controller);

      (async () => {
        try {
          const lobbies = await fetchLobbies();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ lobbies })}\n\n`));
        } catch (err) {
          console.error("Lobbies SSE initial fetch failed:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ lobbies: [] })}\n\n`));
        }
      })();

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
      "Connection": "keep-alive",
    },
  });
}
