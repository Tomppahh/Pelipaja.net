import Lobby from "@/src/models/lobby";
import Match from "@/src/models/Match";
import { broadcastLobbyUpdate } from "@/src/backend/services/sse";
import { log } from "@/src/backend/lib/logger";

const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let cleanupStarted = false;

export function ensureLobbyCleanupStarted() {
  if (cleanupStarted) return;
  cleanupStarted = true;

  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - EXPIRY_MS);
      const expired = await Lobby.find({
        phase: "waiting",
        updatedAt: { $lt: cutoff },
      }).select("matchId");

      for (const lobby of expired) {
        const matchId = lobby.matchId.toString();

        // Cancel the associated match if it's still pending
        await Match.findOneAndUpdate(
          { _id: matchId, status: "pending" },
          { status: "cancelled" }
        );

        await Lobby.deleteOne({ matchId });
        broadcastLobbyUpdate(matchId, { closed: true });
        log(`Lobby ${matchId} expired after 30 minutes of inactivity`);
      }
    } catch (err) {
      console.error("[LobbyCleanup] Error:", err);
    }
  }, CHECK_INTERVAL_MS);
}
