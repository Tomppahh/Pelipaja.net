"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";
import { CS2_MODES } from "@/src/backend/games/cs2/config/modes";

export default function CreateCS2MatchPage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState(CS2_MODES[0]);
  const [selectedMap, setSelectedMap] = useState(CS2_MAPS[0]);
  const [teamSize, setTeamSize] = useState(CS2_MODES[0].defaultTeamSize);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleModeChange(modeId: string) {
    const mode = CS2_MODES.find(m => m.id === modeId)!;
    setSelectedMode(mode);
    setTeamSize(mode.defaultTeamSize);
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "cs2",
          gameConfig: {
            map: selectedMap,
            mode: selectedMode.id,
            knifeRound: selectedMode.id === "competitive",
          },
          playersPerTeam: teamSize,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }

      // Redirect to match page
      router.push(`/match/${data.matchId}`);

    } catch {
      setError("Failed to create match");
      setLoading(false);
    }
  }

  return (
    <div>
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
        <h2 className="pt-3 text-[var(--muted)]">Map</h2>
        <div className="flex flex-wrap gap-2">
          {CS2_MAPS.map((map) => {
            const isSelectedMap = selectedMap === map;

            return (
              <button
                key={map}
                onClick={() => setSelectedMap(map)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  isSelectedMap
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {map}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-5 rounded-lg border border-[var(--accent-2)] bg-[var(--accent-2)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating..." : "Create Match"}
      </button>
    </div>
  );
}