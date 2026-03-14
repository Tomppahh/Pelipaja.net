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

      <div>
        <h2>Game Mode</h2>
        {CS2_MODES.map(mode => (
          <button
            key={mode.id}
            onClick={() => handleModeChange(mode.id)}
            style={{ fontWeight: selectedMode.id === mode.id ? "bold" : "normal" }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div>
        <h2>Team Size</h2>
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
        <h2>Map</h2>
        {CS2_MAPS.map(map => (
          <button
            key={map}
            onClick={() => setSelectedMap(map)}
            style={{ fontWeight: selectedMap === map ? "bold" : "normal" }}
          >
            {map}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Creating..." : "Create Match"}
      </button>
    </div>
  );
}