"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/src/app/components/ui/button";
import { PageTitle, Muted } from "@/src/app/components/ui/typography";

interface MatchSummary {
  _id: string;
  matchId: string;
  map: string;
  score: { ct: number; t: number };
  team1: { name: string; score: number };
  team2: { name: string; score: number };
  duration: number;
  createdAt: string;
}

interface OngoingMatch {
  matchId: string;
  status: string;
  map: string;
  mode: string;
  name?: string;
  teamSize: number;
  playerCount: number;
  capacity: number;
  isBotTest?: boolean;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; ring: string }> = {
  live:        { label: "Live",        dot: "bg-green-400",  ring: "ring-green-400/30" },
  ready:       { label: "Ready",       dot: "bg-[var(--accent)]",  ring: "ring-[var(--accent)]/30" },
  configuring: { label: "Starting",    dot: "bg-[var(--warning)]", ring: "ring-[var(--warning)]/30" },
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [ongoing, setOngoing] = useState<OngoingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function fetchMatches(p: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches?page=${p}&limit=20`);
      const data = await res.json();
      setMatches(data.matches ?? []);
      setTotalPages(data.pagination?.pages ?? 1);
    } catch {
      setMatches([]);
    }
    setLoading(false);
  }

  async function fetchOngoing() {
    try {
      const res = await fetch("/api/matches/ongoing");
      const data = await res.json();
      setOngoing(data.ongoing ?? []);
    } catch {
      setOngoing([]);
    }
  }

  useEffect(() => {
    fetchMatches(page);
    fetchOngoing();
    const interval = setInterval(fetchOngoing, 15000);
    return () => clearInterval(interval);
  }, [page]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fi-FI", {
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

      {/* Ongoing Matches */}
      {ongoing.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
            </span>
            <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
              Live Now
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {ongoing.map((m) => {
              const st = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.configuring;
              return (
                <Link
                  key={m.matchId}
                  href={`/matches/${m.matchId}`}
                  className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]/40 hover:bg-[var(--surface-hover)] sm:p-5"
                >
                  {/* Accent left edge */}
                  <div className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)] opacity-60 transition group-hover:opacity-100" />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-semibold text-[var(--foreground)]">
                          {m.name ?? "Public Lobby"}
                        </span>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          m.status === "live"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-[var(--accent)]/10 text-[var(--accent)]"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                        <span className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 font-medium text-[var(--foreground)]/80">
                          {m.map}
                        </span>
                        <span>{m.teamSize}v{m.teamSize}</span>
                        <span className="text-[var(--foreground)]/50">·</span>
                        <span>{m.playerCount}/{m.capacity}</span>
                      </div>
                    </div>

                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {timeAgo(m.createdAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* History */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <PageTitle>Matches</PageTitle>
            <Muted className="mt-0.5">Completed games</Muted>
          </div>
          <Button variant="secondary" size="sm" onClick={() => { fetchMatches(page); fetchOngoing(); }}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-[var(--muted)]">Loading…</div>
        ) : matches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
            <Muted>No completed matches yet</Muted>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {matches.map((m) => (
                <Link
                  key={m._id}
                  href={`/matches/${m.matchId}`}
                  className="group flex items-center gap-4 rounded-xl border border-transparent bg-[var(--surface)]/50 px-4 py-3 transition hover:border-[var(--border)] hover:bg-[var(--surface)] sm:px-5 sm:py-4"
                >
                  {/* Team 1 */}
                  <span className="min-w-0 flex-1 truncate text-right text-sm font-medium text-[var(--foreground)]/80">
                    {m.team1?.name ?? "Team 1"}
                  </span>

                  {/* Score */}
                  <div className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                    <span className={`text-xl font-bold ${
                      (m.score?.ct ?? 0) > (m.score?.t ?? 0)
                        ? "text-[var(--accent)]"
                        : (m.score?.ct ?? 0) < (m.score?.t ?? 0)
                          ? "text-[var(--foreground)]/50"
                          : "text-[var(--muted)]"
                    }`}>
                      {m.score?.ct ?? 0}
                    </span>
                    <span className="text-sm text-[var(--muted)]">:</span>
                    <span className={`text-xl font-bold ${
                      (m.score?.t ?? 0) > (m.score?.ct ?? 0)
                        ? "text-[var(--accent)]"
                        : (m.score?.t ?? 0) < (m.score?.ct ?? 0)
                          ? "text-[var(--foreground)]/50"
                          : "text-[var(--muted)]"
                    }`}>
                      {m.score?.t ?? 0}
                    </span>
                  </div>

                  {/* Team 2 */}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--foreground)]/80">
                    {m.team2?.name ?? "Team 2"}
                  </span>

                  {/* Map + meta */}
                  <div className="hidden shrink-0 items-center gap-3 sm:flex">
                    <span className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs font-medium text-[var(--foreground)]/60">
                      {m.map}
                    </span>
                    {m.duration != null && m.duration > 0 && (
                      <span className="text-xs tabular-nums text-[var(--muted)]">
                        {formatDuration(m.duration)}
                      </span>
                    )}
                    <span className="text-xs text-[var(--foreground)]/30">
                      {formatDate(m.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="min-w-[6ch] text-center text-sm tabular-nums text-[var(--muted)]">
                  {page}/{totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
