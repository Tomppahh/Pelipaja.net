"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ServerCounter } from "@/src/app/components/user/serverCounter";

const LOBBY_MODES = [
  { id: "use_current_teams", label: "Use Current Teams" },
  { id: "captain_pick",      label: "Captain Pick" },
  { id: "captain_map_veto",  label: "Captain Map Veto" },
  { id: "pick_map",          label: "Pick Map" },
] as const;

type LobbyMode = (typeof LOBBY_MODES)[number]["id"];

export default function CreateMatchPage() {
  const router = useRouter();
  const [lobbyMode, setLobbyMode] = useState<LobbyMode>("use_current_teams");
  const [teamSize, setTeamSize] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createMatch() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "cs2", lobbyMode, teamSize }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push(`/match/${data.matchId}/lobby`);
    } catch {
      setError("Failed to create match");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-3xl items-center justify-center px-4 py-8 sm:px-6">
      <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-8 shadow-2xl backdrop-blur">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--foreground)]">
          Create Match
        </h1>
        <ServerCounter />

        <div className="mt-6 flex flex-col gap-6">
          {/* Lobby mode */}
          <div>
            <p className="mb-2 text-sm text-[var(--muted)]">Lobby mode</p>
            <div className="flex flex-wrap gap-2">
              {LOBBY_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setLobbyMode(mode.id)}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    lobbyMode === mode.id
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Team size */}
          <div>
            <p className="mb-2 text-sm text-[var(--muted)]">Players per team</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={10}
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <span className="text-sm text-[var(--muted)]">players per team</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Create button */}
          <button
            onClick={createMatch}
            disabled={loading}
            className="self-start rounded-lg border border-[var(--accent-2)] bg-[var(--accent-2)] px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create CS2 Match"}
          </button>
        </div>
      </section>
    </main>
  );
}