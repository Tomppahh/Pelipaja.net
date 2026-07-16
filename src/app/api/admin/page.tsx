"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/src/app/components/ui/button";
import { Card } from "@/src/app/components/ui/card";
import { Toast } from "@/src/app/components/ui/toast";
import { PageTitle, SectionTitle, Muted } from "@/src/app/components/ui/typography";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";
import type { PlayerMatchStats } from "@/src/lib/types/match";

interface Match {
  _id: string;
  gameType?: string;
  status: string;
  gameConfig: { map: string; mode?: string; ownerName?: string };
  connectionIp: string;
  connectionPort: number;
  apiPort?: number;
  createdAt: string;
}

interface LiveStats {
  map: string;
  score: { ct: number; t: number };
  round: number;
  players: PlayerMatchStats[];
}

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedMap, setSelectedMap] = useState(CS2_MAPS[0]);
  const [teamSize, setTeamSize] = useState(5);
  const [toast, setToast] = useState<{ message: string; variant: "error" | "success" } | null>(null);
  const [liveStats, setLiveStats] = useState<Record<string, LiveStats>>({});

  function getStatusClasses(status: string) {
    const normalized = status.toLowerCase();
    if (normalized === "active" || normalized === "running" || normalized === "live") {
      return "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/40";
    }
    if (normalized === "stopping" || normalized === "pending") {
      return "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/40";
    }
    return "bg-[var(--surface-hover)] text-[var(--muted)] border-[var(--border)]";
  }

  function getServerName(match: Match) {
    const gameType = match.gameType ?? "cs2";
    if (!match.connectionPort) {
      return `${gameType}?`;
    }

    if (gameType === "cs2") {
      const slot = match.connectionPort - 27014;
      return slot > 0 ? `cs2${slot}` : "cs2?";
    }

    return `${gameType}-${match.connectionPort}`;
  }

  async function fetchMatches() {
    try {
      const res = await fetch("/api/admin/servers");
      const data = await res.json();
      setMatches(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function fetchLiveStats(matchId: string) {
    try {
      const res = await fetch(`/api/matches/${matchId}/stats`);
      if (res.ok) {
        const data = await res.json();
        if (data.data?.players) {
          setLiveStats((prev) => ({
            ...prev,
            [matchId]: {
              map: data.data.map,
              score: data.data.score,
              round: data.data.round ?? 0,
              players: data.data.players,
            },
          }));
        }
      }
    } catch {
      // silent
    }
  }

  async function fetchAllLiveStats() {
    const liveMatches = matches.filter(
      (m) => m.status === "live" || m.status === "ready"
    );
    await Promise.all(liveMatches.map((m) => fetchLiveStats(m._id)));
  }

  // Poll live stats every 30 seconds
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (matches.length === 0) return;
    const liveMatches = matches.filter(
      (m) => m.status === "live" || m.status === "ready"
    );
    if (liveMatches.length === 0) return;

    fetchAllLiveStats();
    const interval = setInterval(fetchAllLiveStats, 30000);
    return () => clearInterval(interval);
  }, [matches]);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function stopServer(matchId: string) {
    await fetch(`/api/admin/servers/${matchId}`, { method: "DELETE" });
    fetchMatches();
  }

  async function createServer() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ map: selectedMap, teamSize }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: `Server created! Connect: ${data.connectionIp}:${data.connectionPort}`, variant: "success" });
        fetchMatches();
      } else {
        setToast({ message: data.error ?? "Failed to create server", variant: "error" });
      }
    } catch {
      setToast({ message: "Failed to create server", variant: "error" });
    }
    setCreating(false);
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchMatches();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-6">
        <Card className="mx-auto max-w-5xl p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-semibold text-[var(--foreground)]">Loading admin panel...</p>
        </Card>
      </main>
    );
  }

  const liveMatches = matches.filter((m) => m.status === "live" || m.status === "ready");

  return (
    <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
      <section className="mx-auto max-w-5xl 2xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 shadow-2xl backdrop-blur sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <PageTitle className="text-3xl sm:text-4xl">Admin Panel</PageTitle>
            <Muted className="mt-1 text-sm sm:text-base">Monitor and manage active game servers</Muted>
          </div>
          <Button onClick={fetchMatches}>
            Refresh
          </Button>
        </div>

        {toast && (
          <div className="mb-4">
            <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />
          </div>
        )}

        {/* Create Server */}
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 shadow-md sm:p-5">
          <SectionTitle className="mb-3 text-lg">Create Test Server</SectionTitle>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Start a CS2 server without a lobby. Useful for testing plugin updates.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Map</label>
              <select
                value={selectedMap}
                onChange={e => setSelectedMap(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {CS2_MAPS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Team Size</label>
              <input
                type="number"
                min={1} max={10}
                value={teamSize}
                onChange={e => setTeamSize(Number(e.target.value))}
                className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <Button onClick={createServer} disabled={creating}>
              {creating ? "Creating..." : "Create Server"}
            </Button>
          </div>
        </div>

        {/* Live Match Monitoring */}
        {liveMatches.length > 0 && (
          <div className="mb-6">
            <SectionTitle className="mb-4 text-xl">Live Matches</SectionTitle>
            <div className="space-y-4">
              {liveMatches.map((match) => {
                const stats = liveStats[match._id];
                return (
                  <div
                    key={match._id}
                    className="rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/5 p-4 shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold text-[var(--foreground)]">
                          {match.gameConfig.map}
                        </p>
                        {stats && (
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            Score: <span className="font-bold text-[var(--accent)]">{stats.score.ct} - {stats.score.t}</span>
                            {stats.round > 0 && <span className="ml-2">Round {stats.round}</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-[var(--success)]/40 bg-[var(--success)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--success)]">
                          Live
                        </span>
                        <Link
                          href={`/matches/${match._id}`}
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
                        >
                          View
                        </Link>
                      </div>
                    </div>

                    {stats && stats.players.length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border)] text-left uppercase tracking-wider text-[var(--muted)]">
                              <th className="pb-1 pr-2">Player</th>
                              <th className="pb-1 px-2 text-center">K</th>
                              <th className="pb-1 px-2 text-center">D</th>
                              <th className="pb-1 px-2 text-center">A</th>
                              <th className="pb-1 px-2 text-center">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...stats.players]
                              .sort((a, b) => b.score - a.score)
                              .map((p) => (
                                <tr key={p.steamId} className="border-b border-[var(--border)]/30">
                                  <td className="py-1 pr-2 text-[var(--foreground)]">{p.name}</td>
                                  <td className="py-1 px-2 text-center tabular-nums">{p.kills}</td>
                                  <td className="py-1 px-2 text-center tabular-nums">{p.deaths}</td>
                                  <td className="py-1 px-2 text-center tabular-nums">{p.assists}</td>
                                  <td className="py-1 px-2 text-center tabular-nums font-semibold text-[var(--accent)]">{p.score}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Servers */}
        <SectionTitle className="mb-4 text-xl">Active Servers</SectionTitle>

        {matches.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-8 text-center text-[var(--muted)]">
            No active servers
          </div>
        )}

        <div className="grid gap-4">
          {matches.map((match) => (
            <article
              key={match._id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 shadow-md transition hover:bg-[var(--surface-hover)]/70 hover:shadow-lg sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-[var(--foreground)]">{match.gameConfig.map}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Server: <span className="font-semibold text-[var(--accent)]">{getServerName(match)}</span>
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Owner: <span className="font-semibold text-[var(--accent)]">{match.gameConfig.ownerName ?? "Unknown"}</span>
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Connect {match.connectionIp}:{match.connectionPort}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusClasses(match.status)}`}
                >
                  {match.status}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <Link href={`/match/${match._id}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]">
                Match Page
                </Link>
                <Button variant="danger" onClick={() => stopServer(match._id)}>
                  Stop Server
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
