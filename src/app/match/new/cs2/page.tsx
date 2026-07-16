"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";

export default function CreateCS2MatchPage() {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(false);
  const [lobbyPassword, setLobbyPassword] = useState("");
  const [teamSize, setTeamSize] = useState(5);
  const [captainDraft, setCaptainDraft] = useState(false);
  const [mapVeto, setMapVeto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => {
        setLoggedIn(!!d.steamId);
        setAuthChecked(true);
      })
      .catch(() => {
        setLoggedIn(false);
        setAuthChecked(true);
      });
  }, []);

  function getLobbyMode() {
    if (captainDraft && mapVeto) return "captain_map_veto";
    if (captainDraft) return "captain_pick";
    if (mapVeto) return "pick_map";
    return "use_current_teams";
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const gameConfig: Record<string, unknown> = {
        mode: "competitive",
        knifeRound: true,
        isPublic,
        password: lobbyPassword || undefined,
        map: CS2_MAPS[0],
      };

      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "cs2",
          lobbyMode: getLobbyMode(),
          teamSize,
          gameConfig,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.matchId) {
          router.push(`/match/${data.matchId}/lobby`);
          setLoading(false);
          return;
        }
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }

      router.push(`/match/${data.matchId}/lobby`);
    } catch {
      setError("Failed to create match");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      {authChecked && !loggedIn ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Log in required</h1>
          <a href="/api/auth/steam" className="lg bg-[var(--accent)] px-6 py-2.5 font-semibold text-[var(--accent-contrast)] transition hover:brightness-110">
            Log in with Steam
          </a>
        </div>
      ) : (
        <>
          <h1 className="mb-6 text-2xl font-bold text-[var(--foreground)]">Create a Match</h1>

          {/* Visibility + Team size side by side */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">Visibility</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPublic(false)}
                  className={`flex-1 rounded-lg border-2 px-3 py-3 text-center text-sm font-semibold transition ${
                    !isPublic
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--muted)]"
                  }`}
                >
                  Private
                </button>
                <button
                  onClick={() => setIsPublic(true)}
                  className={`flex-1 rounded-lg border-2 px-3 py-3 text-center text-sm font-semibold transition ${
                    isPublic
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--muted)]"
                  }`}
                >
                  Public
                </button>
              </div>
              {isPublic && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Password (optional)</label>
                  <input
                    type="text"
                    value={lobbyPassword}
                    onChange={e => setLobbyPassword(e.target.value)}
                    placeholder="Leave empty for no password"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">Players per team</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTeamSize(s => Math.max(1, s - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-lg font-bold text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
                >
                  −
                </button>
                <span className="w-12 text-center text-2xl font-bold text-[var(--foreground)]">{teamSize}</span>
                <button
                  onClick={() => setTeamSize(s => Math.min(10, s + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-lg font-bold text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Lobby options */}
          <div className="mb-6 flex flex-col gap-3">
            <button
              onClick={() => setCaptainDraft(v => !v)}
              className={`flex items-center justify-between rounded-xl border-2 px-5 py-3.5 text-left transition ${
                captainDraft
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--muted)]"
              }`}
            >
              <div>
                <p className="font-semibold text-[var(--foreground)]">Captain draft</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">Captains pick players instead of players choosing freely</p>
              </div>
              <div className={`ml-4 h-6 w-11 shrink-0 rounded-full transition ${
                captainDraft ? "bg-[var(--accent)]" : "bg-[var(--muted)]/30"
              }`}>
                <div className={`h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition ${
                  captainDraft ? "translate-x-5.5" : "translate-x-0.5"
                }`} />
              </div>
            </button>

            <button
              onClick={() => setMapVeto(v => !v)}
              className={`flex items-center justify-between rounded-xl border-2 px-5 py-3.5 text-left transition ${
                mapVeto
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--muted)]"
              }`}
            >
              <div>
                <p className="font-semibold text-[var(--foreground)]">Map veto</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">Captains ban maps until one remains. Otherwise you pick the map.</p>
              </div>
              <div className={`ml-4 h-6 w-11 shrink-0 rounded-full transition ${
                mapVeto ? "bg-[var(--accent)]" : "bg-[var(--muted)]/30"
              }`}>
                <div className={`h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition ${
                  mapVeto ? "translate-x-5.5" : "translate-x-0.5"
                }`} />
              </div>
            </button>
          </div>

          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent-2)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create Match"}
          </button>
        </>
      )}
    </div>
  );
}
