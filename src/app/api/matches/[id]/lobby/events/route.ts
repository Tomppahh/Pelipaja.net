import { NextRequest } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import Lobby from "@/src/models/lobby";
import { registerSubscriber, unregisterSubscriber } from "@/src/backend/services/sse";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await connectDB();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));

      registerSubscriber(id, send);

      // Send current lobby state immediately on connect
      const lobby = await Lobby.findOne({ matchId: id });
      if (lobby) send(`data: ${JSON.stringify(lobby.toObject())}\n\n`);

      req.signal.addEventListener("abort", () => {
        unregisterSubscriber(id, send);
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