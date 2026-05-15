"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateLobbyButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createLobby() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "cs2",
          lobbyMode: "use_current_teams",
          teamSize: 5,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.matchId) {
        router.push(`/match/${data.matchId}/lobby`);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to create lobby");
        return;
      }

      router.push(`/match/${data.matchId}/lobby`);
    } catch {
      setError("Failed to create lobby");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-16 flex flex-col items-center gap-3">
      <button
        onClick={createLobby}
        disabled={loading}
        className="inline-block rounded-lg bg-[var(--accent)] px-6 py-3 font-bold text-[var(--accent-contrast)] shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating Lobby..." : "Create Lobby"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}