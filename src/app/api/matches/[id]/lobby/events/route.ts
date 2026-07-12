import { NextRequest } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import { getSession } from "@/src/backend/lib/session";
import Lobby from "@/src/models/lobby";
import Match from "@/src/models/Match";
import { registerSubscriber, unregisterSubscriber } from "@/src/backend/services/sse";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) {
    return new Response(JSON.stringify({ error: "You must be logged in to connect to lobby events." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;
  await connectDB();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));

      // Subscribe to both channels so the page also receives match status
      // updates (e.g. server becomes ready) broadcast on the "match" channel.
      registerSubscriber("lobby", id, send);
      registerSubscriber("match", id, send);

      // Send current lobby + match state immediately on connect
      const lobby = await Lobby.findOne({ matchId: id });
      if (lobby) send(`data: ${JSON.stringify(lobby.toObject())}\n\n`);

      const match = await Match.findById(id).lean();
      if (match) {
        const map =
          (match.gameConfig as Record<string, unknown> | undefined)?.map ??
          lobby?.settings.workshopMapName ??
          lobby?.settings.map ??
          lobby?.mapVetoState?.remainingMaps?.[0] ??
          lobby?.settings.mapPool?.[0];
        send(`data: ${JSON.stringify({ __type: "matchUpdate", ...match, map })}\n\n`);
      }

      const heartbeat = setInterval(() => {
        send(`data: {"heartbeat":true}\n\n`);
      }, 30000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unregisterSubscriber("lobby", id, send);
        unregisterSubscriber("match", id, send);
        controller.close();
      });
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