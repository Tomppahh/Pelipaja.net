"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/src/app/components/ui/card";
import { Button } from "@/src/app/components/ui/button";
import { PageTitle, Muted } from "@/src/app/components/ui/typography";

interface MatchSummary {
  _id: string;
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
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  configuring: "Starting",
  ready: "Ready",
  live: "Live",
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
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  return (
    <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
      <section className="mx-auto max-w-4xl rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 shadow-2xl backdrop-blur sm:p-8">

        {/* Ongoing Matches */}
        {ongoing.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 font-display text-2xl font-bold tracking-tight text-[var(--foreground)]">Ongoing Matches</h2>
            <div className="space-y-3">
              {ongoing.map((m) => (
                <Link
                  key={m.matchId}
                  href={`/match/${m.matchId}/lobby`}
                  className="block rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 shadow-md transition hover:bg-[var(--accent)]/10 hover:shadow-lg sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-[var(--foreground)]">
                          {m.name ?? "Public Lobby"}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          m.status === "live"
                            ? "border-green-500/40 bg-green-500/10 text-green-400"
                            : "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
                        }`}>
                          {STATUS_LABEL[m.status] ?? m.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-[var(--muted)]">
                        <span>{m.map}</span>
                        <span>{m.teamSize}v{m.teamSize}</span>
                        <span>{m.playerCount}/{m.capacity} players</span>
                      </div>
                    </div>
                    <span className="text-sm text-[var(--muted)]">
                      {formatDate(m.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Match History */}
        <div className="mb-6 flex items-center justify-between">
          <PageTitle className="text-3xl sm:text-4xl">Match History</PageTitle>
          <Button variant="secondary" onClick={() => { fetchMatches(page); fetchOngoing(); }}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[var(--muted)]">Loading matches...</div>
        ) : matches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-12 text-center text-[var(--muted)]">
            No completed matches yet
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {matches.map((m) => (
                <Link
                  key={m._id}
                  href={`/matches/${m._id}`}
                  className="block rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 shadow-md transition hover:bg-[var(--surface-hover)]/70 hover:shadow-lg sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-[var(--foreground)]">
                          {m.team1?.name ?? "Team 1"}
                        </span>
                        <span className="text-xl font-bold text-[var(--accent)]">
                          {m.score?.ct ?? 0} - {m.score?.t ?? 0}
                        </span>
                        <span className="text-lg font-semibold text-[var(--foreground)]">
                          {m.team2?.name ?? "Team 2"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-[var(--muted)]">
                        <span>{m.map}</span>
                        {m.duration != null && m.duration > 0 && (
                          <span>{formatDuration(m.duration)}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-[var(--muted)]">
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
                <span className="text-sm text-[var(--muted)]">
                  Page {page} of {totalPages}
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
