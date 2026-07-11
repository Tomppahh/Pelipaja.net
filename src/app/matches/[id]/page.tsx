"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/src/app/components/ui/card";
import { Button } from "@/src/app/components/ui/button";
import { PageTitle, Muted } from "@/src/app/components/ui/typography";
import type { PlayerMatchStats } from "@/src/lib/types/match";

interface MatchData {
  status: string;
  source: "plugin" | "database" | "none";
  data: {
    map: string;
    score: { ct: number; t: number };
    round?: number;
    duration?: number;
    team1?: { name: string; score: number; players: PlayerMatchStats[] };
    team2?: { name: string; score: number; players: PlayerMatchStats[] };
    team1Name?: string;
    team2Name?: string;
    players?: PlayerMatchStats[];
  } | null;
  error?: string;
}

function sortPlayers(players: PlayerMatchStats[]) {
  return [...players].sort((a, b) => b.score - a.score);
}

function num(n: number | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function hsPercent(p: PlayerMatchStats) {
  const k = num(p.kills);
  if (k === 0) return "0%";
  return `${Math.round((num(p.headshotKills) / k) * 100)}%`;
}

function entryWinPercent(p: PlayerMatchStats) {
  const total = num(p.entryKills) + num(p.entryDeaths);
  if (total === 0) return "-";
  return `${Math.round((num(p.entryKills) / total) * 100)}%`;
}

function sideLabel(side: string) {
  return side === "CT" ? "CT" : "T";
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${id}/stats`);
      if (res.ok) {
        const data = await res.json();
        setMatch(data);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Poll live matches every round-end interval (~2 minutes)
  useEffect(() => {
    if (!match || match.status === "finished" || match.status === "cancelled") return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [match?.status, fetchStats]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
        <Card className="mx-auto max-w-5xl p-8 shadow-2xl backdrop-blur">
          <Muted>Loading match...</Muted>
        </Card>
      </main>
    );
  }

  if (!match || !match.data) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
        <Card className="mx-auto max-w-5xl p-8 shadow-2xl backdrop-blur">
          <Muted>No match data available</Muted>
        </Card>
      </main>
    );
  }

  const { data, status, source } = match;
  const isLive = status === "live" || status === "ready";
  const round = data.round ?? 0;
  const halftime = round > 12;

  // Split players into teams
  let team1Players: PlayerMatchStats[] = [];
  let team2Players: PlayerMatchStats[] = [];
  let team1Name = "Team 1";
  let team2Name = "Team 2";
  let team1Side = "CT";
  let team2Side = "T";

  if (data.team1 && data.team2) {
    team1Players = sortPlayers(data.team1.players);
    team2Players = sortPlayers(data.team2.players);
    team1Name = data.team1.name;
    team2Name = data.team2.name;
    // For database results, team1 is always the first team, sides swap at halftime
    team1Side = halftime ? "T" : "CT";
    team2Side = halftime ? "CT" : "T";
  } else if (data.players) {
    // From plugin — split by team
    const ct = data.players.filter((p) => p.team === "CT");
    const t = data.players.filter((p) => p.team === "T");
    // Use team names from API if available
    team1Name = data.team1Name ?? "Team 1";
    team2Name = data.team2Name ?? "Team 2";
    // Before halftime: team1 is CT, after: team1 is T
    team1Side = halftime ? "T" : "CT";
    team2Side = halftime ? "CT" : "T";
    // Always show CT first, T second (sides are visual)
    team1Players = sortPlayers(ct);
    team2Players = sortPlayers(t);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
      <section className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <PageTitle className="text-2xl sm:text-3xl">{data.map}</PageTitle>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-3xl font-bold text-[var(--accent)]">
                  {data.score?.ct ?? 0} - {data.score?.t ?? 0}
                </span>
                {isLive && (
                  <span className="rounded-full border border-[var(--success)]/40 bg-[var(--success)]/10 px-3 py-1 text-xs font-semibold text-[var(--success)]">
                    LIVE {data.round != null && `R${data.round}`}
                  </span>
                )}
                {status === "finished" && (
                  <span className="rounded-full border border-[var(--muted)]/40 bg-[var(--muted)]/10 px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                    FINAL
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {data.duration != null && data.duration > 0 && (
                <Muted>{formatDuration(data.duration)}</Muted>
              )}
              <Muted>{source === "plugin" ? "Live" : "Database"}</Muted>
              <Button variant="secondary" size="sm" onClick={() => fetchStats()}>
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Team panels */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TeamPanel
            name={team1Name}
            side={team1Side}
            score={team1Side === "CT" ? (data.score?.ct ?? 0) : (data.score?.t ?? 0)}
            players={team1Players}
            expanded={expanded}
          />
          <TeamPanel
            name={team2Name}
            side={team2Side}
            score={team2Side === "CT" ? (data.score?.ct ?? 0) : (data.score?.t ?? 0)}
            players={team2Players}
            expanded={expanded}
          />
        </div>

        {/* Expand toggle */}
        <div className="text-center">
          <Button variant="secondary" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show Less" : "Show Detailed Stats"}
          </Button>
        </div>
      </section>
    </main>
  );
}

function TeamPanel({
  name,
  side,
  score,
  players,
  expanded,
}: {
  name: string;
  side: string;
  score: number;
  players: PlayerMatchStats[];
  expanded: boolean;
}) {
  const sideColor = side === "CT" ? "text-[var(--accent)]" : "text-[var(--accent-2)]";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 shadow-2xl backdrop-blur">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-[var(--foreground)]">{name}</h2>
        <div className="flex items-baseline gap-3">
          <span className={`text-2xl font-semibold ${sideColor}`}>{sideLabel(side)}</span>
          <span className="text-2xl font-bold text-[var(--accent)]">{score}</span>
        </div>
      </div>

      {players.length === 0 ? (
        <Muted>No players</Muted>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--muted)]">
                <th className="pb-2 pr-2">Player</th>
                <th className="pb-2 px-2 text-center">K</th>
                <th className="pb-2 px-2 text-center">D</th>
                <th className="pb-2 px-2 text-center">A</th>
                <th className="pb-2 px-2 text-center">+/-</th>
                <th className="pb-2 px-2 text-center">ADR</th>
                <th className="pb-2 pl-2 text-center">Score</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr
                  key={p.steamId}
                  className="border-b border-[var(--border)]/50 transition hover:bg-[var(--surface-hover)]/50"
                >
                  <td className="py-2 pr-2">
                    <span className="font-medium text-[var(--foreground)]">{p.name}</span>
                  </td>
                  <td className="py-2 px-2 text-center tabular-nums text-[var(--foreground)]">{num(p.kills)}</td>
                  <td className="py-2 px-2 text-center tabular-nums text-[var(--foreground)]">{num(p.deaths)}</td>
                  <td className="py-2 px-2 text-center tabular-nums text-[var(--foreground)]">{num(p.assists)}</td>
                  <td className="py-2 px-2 text-center tabular-nums text-[var(--foreground)]">
                    {num(p.kills) - num(p.deaths) >= 0 ? "+" : ""}{num(p.kills) - num(p.deaths)}
                  </td>
                  <td className="py-2 px-2 text-center tabular-nums text-[var(--muted)]">
                    {num(p.totalDamage) > 0 ? Math.round(num(p.totalDamage) / Math.max(1, 30)) : 0}
                  </td>
                  <td className="py-2 pl-2 text-center tabular-nums font-semibold text-[var(--accent)]">{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {expanded && (
            <table className="mt-3 w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-left uppercase tracking-wider text-[var(--muted)]">
                  <th className="pb-1 pr-2">Player</th>
                  <th className="pb-1 px-2 text-center">HS%</th>
                  <th className="pb-1 px-2 text-center">ADR</th>
                  <th className="pb-1 px-2 text-center">UDmg</th>
                  <th className="pb-1 px-2 text-center">Flash</th>
                  <th className="pb-1 px-2 text-center">Entry%</th>
                  <th className="pb-1 px-2 text-center">Clutch</th>
                  <th className="pb-1 pl-2 text-center">Ping</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr
                    key={p.steamId}
                    className="border-b border-[var(--border)]/30"
                  >
                    <td className="py-1.5 pr-2 text-[var(--muted)]">{p.name}</td>
                    <td className="py-1.5 px-2 text-center tabular-nums">{hsPercent(p)}</td>
                    <td className="py-1.5 px-2 text-center tabular-nums">
                      {num(p.totalDamage) > 0 ? Math.round(num(p.totalDamage) / Math.max(1, 30)) : 0}
                    </td>
                    <td className="py-1.5 px-2 text-center tabular-nums">{num(p.utilityDamage)}</td>
                    <td className="py-1.5 px-2 text-center tabular-nums">{num(p.flashAssists)}</td>
                    <td className="py-1.5 px-2 text-center tabular-nums">{entryWinPercent(p)}</td>
                    <td className="py-1.5 px-2 text-center tabular-nums">
                      {num(p.oneVoneCount) > 0 ? `${num(p.oneVoneWins)}/${num(p.oneVoneCount)}` : "-"}
                    </td>
                    <td className="py-1.5 pl-2 text-center tabular-nums">{p.ping}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
