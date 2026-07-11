"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";
import { CS2_MODES, CS2_LOBBY_MODES, type LobbyModeId } from "@/src/backend/games/cs2/config/modes";

export default function CreateCS2MatchPage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState(CS2_MODES[0]);
  const [lobbyType, setLobbyType] = useState<LobbyModeId>("use_current_teams");
  const [teamSize, setTeamSize] = useState(CS2_MODES[0].defaultTeamSize);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Public lobby
  const [isPublic, setIsPublic] = useState(false);
  const [lobbyName, setLobbyName] = useState("");
  const [lobbyPassword, setLobbyPassword] = useState("");

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

  function handleModeChange(modeId: string) {
    const mode = CS2_MODES.find(m => m.id === modeId)!;
    setSelectedMode(mode);
    setTeamSize(mode.defaultTeamSize);
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const gameConfig: Record<string, unknown> = {
        mode: selectedMode.id,
        knifeRound: selectedMode.id === "competitive",
        isPublic,
        name: lobbyName.trim() || undefined,
        password: lobbyPassword || undefined,
      };

      // Map is now chosen inside the lobby (so it's all in one place).
      // Send a default so the server has something to fall back to.
      if (lobbyType === "use_current_teams") {
        gameConfig.map = CS2_MAPS[0];
      }

      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "cs2",
          lobbyMode: lobbyType,
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
    <div>
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
          <h1>Create CS2 Match</h1>

      <div className="flex flex-col gap-2">
        <h2 className="pt-3 text-[var(--muted)]">Game Mode</h2>

        <div className="flex flex-wrap gap-2">
          {CS2_MODES.map((mode) => {
            const isSelected = selectedMode.id === mode.id;

            return (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition
                  ${isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="pt-3 text-[var(--muted)]">Lobby Type</h2>
        <div className="flex flex-wrap gap-2">
          {CS2_LOBBY_MODES.map((mode) => {
            const isSelected = lobbyType === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setLobbyType(mode.id)}
                className={`rounded-lg border px-4 py-2 text-left text-sm font-semibold transition ${
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <div>{mode.label}</div>
                <div className="mt-0.5 text-xs font-normal opacity-80">{mode.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="pt-3 text-[var(--muted)]">Team Size</h2>
        <input
          type="number"
          min={1}
          max={10}
          value={teamSize}
          onChange={e => setTeamSize(parseInt(e.target.value))}
        />
        <span> players per team</span>
      </div>

      <div>
        <h2 className="pt-3 text-[var(--muted)]">Lobby Visibility</h2>
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setIsPublic(false)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              !isPublic
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Private
          </button>
          <button
            onClick={() => setIsPublic(true)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              isPublic
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Public
          </button>
        </div>

        {isPublic && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                Lobby Name (optional)
              </label>
              <input
                type="text"
                value={lobbyName}
                onChange={e => setLobbyName(e.target.value)}
                maxLength={60}
                placeholder="My CS2 Lobby"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                Password (optional)
              </label>
              <input
                type="password"
                value={lobbyPassword}
                onChange={e => setLobbyPassword(e.target.value)}
                placeholder="Leave open for anyone to join"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-5 rounded-lg border border-[var(--accent-2)] bg-[var(--accent-2)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating..." : "Create Match"}
      </button>
        </>
      )}
    </div>
  );
}
