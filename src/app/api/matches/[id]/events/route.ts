import { NextRequest } from "next/server";
import { connectDB } from "@/src/backend/lib/db";
import { getSession } from "@/src/backend/lib/session";
import { registerSubscriber, unregisterSubscriber } from "@/src/backend/services/sse";
import { getMatchView } from "@/src/backend/lobby/matchView";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) {
    return new Response(
      JSON.stringify({ error: "You must be logged in to connect to match events." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const { id } = await params;
  await connectDB();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));

      registerSubscriber("match", id, send);

      // Send current match state immediately on connect
      const view = await getMatchView(id, user);
      if (view) send(`data: ${JSON.stringify(view)}\n\n`);
      else send(`data: ${JSON.stringify({ error: "Match not found" })}\n\n`);

      const heartbeat = setInterval(() => {
        send(`data: {"heartbeat":true}\n\n`);
      }, 30000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
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
