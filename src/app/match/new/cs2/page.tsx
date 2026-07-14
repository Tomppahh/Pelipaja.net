"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";

export default function CreateCS2MatchPage() {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(false);
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
          <p className="text-sm text-[var(--muted)]">You need to be logged in with Steam to create a match.</p>
          <a href="/api/auth/steam" className="rounded-lg bg-[var(--accent)] px-6 py-2.5 font-semibold text-[var(--accent-contrast)] transition hover:brightness-110">
            Log in with Steam
          </a>
        </div>
      ) : (
        <>
          <h1 className="mb-1 text-2xl font-bold text-[var(--foreground)]">Create a Match</h1>
          <p className="mb-8 text-sm text-[var(--muted)]">Set up your CS2 lobby. You can change most options after creating it.</p>

          {/* Visibility */}
          <section className="mb-8">
            <p className="mb-1 text-sm font-semibold text-[var(--foreground)]">Who should see this lobby?</p>
            <p className="mb-4 text-xs text-[var(--muted)]">Public lobbies appear in the lobby browser for anyone to join. Private lobbies are only accessible via invite link.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsPublic(false)}
                className={`rounded-xl border-2 px-5 py-4 text-left transition ${
                  !isPublic
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--muted)]"
                }`}
              >
                <p className="font-semibold text-[var(--foreground)]">Private</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Invite only — share the link with your friends</p>
              </button>
              <button
                onClick={() => setIsPublic(true)}
                className={`rounded-xl border-2 px-5 py-4 text-left transition ${
                  isPublic
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--muted)]"
                }`}
              >
                <p className="font-semibold text-[var(--foreground)]">Public</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Open to everyone — shown in the lobby browser</p>
              </button>
            </div>
          </section>

          {/* Team size */}
          <section className="mb-8">
            <p className="mb-1 text-sm font-semibold text-[var(--foreground)]">How many players per team?</p>
            <p className="mb-4 text-xs text-[var(--muted)]">Pick the team size for your match. You can always add bots to fill empty slots later.</p>
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
              <span className="text-sm text-[var(--muted)]">players per team</span>
            </div>
          </section>

          {/* Lobby options */}
          <section className="mb-8">
            <p className="mb-1 text-sm font-semibold text-[var(--foreground)]">Would you like to…</p>
            <p className="mb-4 text-xs text-[var(--muted)]">Optional features you can enable for this lobby.</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setCaptainDraft(v => !v)}
                className={`flex items-center justify-between rounded-xl border-2 px-5 py-4 text-left transition ${
                  captainDraft
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--muted)]"
                }`}
              >
                <div>
                  <p className="font-semibold text-[var(--foreground)]">Have captains draft players?</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Captains take turns picking players for their teams instead of players choosing freely.</p>
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
                className={`flex items-center justify-between rounded-xl border-2 px-5 py-4 text-left transition ${
                  mapVeto
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--muted)]"
                }`}
              >
                <div>
                  <p className="font-semibold text-[var(--foreground)]">Run a map veto?</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Captains alternate banning maps until one remains. If disabled, you pick the map yourself.</p>
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
          </section>

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
