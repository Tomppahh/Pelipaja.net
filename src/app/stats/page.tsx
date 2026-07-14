"use client";

import { useEffect, useState } from "react";
import { Card } from "@/src/app/components/ui/card";
import { PageTitle, Muted } from "@/src/app/components/ui/typography";
import { Tooltip } from "@/src/app/components/ui/tooltip";

interface MatchRow {
  matchId: string;
  map: string;
  result: "W" | "L";
  score: string;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  hsPercent: number;
  adr: number;
  rating: number;
  duration: number;
  date: string;
}

interface Summary {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKD: number;
  avgHSPercent: number;
  avgADR: number;
  avgRating: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
}

type Bracket = "5v5" | "aim";

function formatDuration(s: number) {
  if (!s) return "-";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({
  label,
  value,
  tooltip,
  accent,
}: {
  label: string;
  value: string | number;
  tooltip: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 px-4 py-3 text-center">
      <div className="flex items-center gap-1">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{label}</span>
        <Tooltip text={tooltip}>
          <span />
        </Tooltip>
      </div>
      <span
        className={`text-2xl font-bold tabular-nums ${accent ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function StatsPage() {
  const [steamId, setSteamId] = useState<string | null>(null);
  const [data, setData] = useState<{ fiveVfive: { summary: Summary; matches: MatchRow[] }; aim: { summary: Summary; matches: MatchRow[] } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [bracket, setBracket] = useState<Bracket>("5v5");
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const me = await meRes.json();
        if (cancelled) return;
        if (!me.steamId) {
          setAuthChecked(true);
          setLoading(false);
          return;
        }
        setSteamId(me.steamId);
        const statsRes = await fetch(`/api/player/${me.steamId}/stats`);
        if (!cancelled && statsRes.ok) setData(await statsRes.json());
      } catch {
        // silent
      }
      if (!cancelled) {
        setAuthChecked(true);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
        <Card className="mx-auto max-w-5xl p-8 shadow-2xl backdrop-blur">
          <Muted>Loading...</Muted>
        </Card>
      </main>
    );
  }

  if (!steamId) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
        <Card className="mx-auto max-w-5xl p-8 shadow-2xl backdrop-blur">
          <Muted>You must be logged in to view stats.</Muted>
        </Card>
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
        <Card className="mx-auto max-w-5xl p-8 shadow-2xl backdrop-blur">
          <Muted>Loading stats...</Muted>
        </Card>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
        <Card className="mx-auto max-w-5xl p-8 shadow-2xl backdrop-blur">
          <Muted>Failed to load stats.</Muted>
        </Card>
      </main>
    );
  }

  const active = bracket === "5v5" ? data.fiveVfive : data.aim;
  const s = active.summary;

  const hasAny = data.fiveVfive.summary.totalMatches > 0 || data.aim.summary.totalMatches > 0;

  return (
    <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
      <section className="mx-auto max-w-5xl space-y-6">
        <div>
          <PageTitle className="text-2xl sm:text-3xl">Player Stats</PageTitle>
          {bracket === "5v5" && s.totalMatches > 0 && (
            <Muted className="mt-1">Based on your last {Math.min(s.totalMatches, 10)} 5v5 matches</Muted>
          )}
          {bracket === "aim" && s.totalMatches > 0 && (
            <Muted className="mt-1">Based on your last {Math.min(s.totalMatches, 10)} aim matches</Muted>
          )}
        </div>

        {/* Bracket tabs */}
        {hasAny && (
          <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)]/40 p-1 self-start">
            <TabButton active={bracket === "5v5"} onClick={() => setBracket("5v5")}>
              5v5
            </TabButton>
            <TabButton active={bracket === "aim"} onClick={() => setBracket("aim")}>
              Aim
            </TabButton>
          </div>
        )}

        {s.totalMatches === 0 ? (
          <Card className="p-8 text-center">
            <Muted>
              {bracket === "5v5"
                ? "No 5v5 matches found. Play some matches to see your stats here."
                : "No aim matches found."}
            </Muted>
          </Card>
        ) : (
          <>
            {/* Summary grid */}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              <StatCard label="Matches" value={s.totalMatches} tooltip="Total matches in this bracket" />
              <StatCard
                label="Win %"
                value={`${s.winRate}%`}
                tooltip={`${s.wins}W - ${s.losses}L`}
                accent={s.winRate >= 50}
              />
              <StatCard label="K/D" value={s.avgKD} tooltip="Average kill/death ratio" accent={s.avgKD >= 1} />
              <StatCard label="HS %" value={`${s.avgHSPercent}%`} tooltip="Average headshot percentage across all kills" />
              <StatCard label="ADR" value={s.avgADR} tooltip="Average damage per round" />
              <StatCard
                label="Rating"
                value={s.avgRating}
                tooltip="HLTV Rating 2.0 — combines kills, impact, survival and consistency"
                accent={s.avgRating >= 1.0}
              />
            </div>

            {/* Match history table */}
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--muted)]">
                    <th className="px-4 py-3">Map</th>
                    <th className="px-4 py-3 text-center">Result</th>
                    <th className="px-4 py-3 text-center">Score</th>
                    <th className="px-4 py-3 text-center">K</th>
                    <th className="px-4 py-3 text-center">D</th>
                    <th className="px-4 py-3 text-center">A</th>
                    <th className="px-4 py-3 text-center">K/D</th>
                    <th className="px-4 py-3 text-center">HS%</th>
                    <th className="px-4 py-3 text-center">ADR</th>
                    <th className="px-4 py-3 text-center">Rating</th>
                    <th className="px-4 py-3 text-center">Time</th>
                    <th className="px-4 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {active.matches.map((m) => (
                    <tr
                      key={m.matchId}
                      className="border-b border-[var(--border)]/50 transition hover:bg-[var(--surface-hover)]/50"
                    >
                      <td className="px-4 py-2.5 font-medium text-[var(--foreground)]">{m.map}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-block min-w-[28px] rounded px-1.5 py-0.5 text-xs font-bold ${
                            m.result === "W"
                              ? "bg-[var(--success)]/15 text-[var(--success)]"
                              : "bg-[var(--danger)]/15 text-[var(--danger)]"
                          }`}
                        >
                          {m.result}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-[var(--foreground)]">{m.score}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-[var(--foreground)]">{m.kills}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-[var(--foreground)]">{m.deaths}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-[var(--foreground)]">{m.assists}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-[var(--foreground)]">{m.kd}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-[var(--foreground)]">{m.hsPercent}%</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-[var(--foreground)]">{m.adr}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums font-semibold text-[var(--foreground)]">
                        {m.rating}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-[var(--muted)]">
                        {formatDuration(m.duration)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[var(--muted)]">{formatDate(m.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </section>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
        active
          ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}
