"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/src/app/components/ui/button";
import { Card } from "@/src/app/components/ui/card";
import { PageTitle, SectionTitle, Muted } from "@/src/app/components/ui/typography";

interface Match {
  _id: string;
  gameType?: string;
  status: string;
  gameConfig: { map: string; mode?: string; ownerName?: string };
  connectionIp: string;
  connectionPort: number;
  createdAt: string;
}

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

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
    const res = await fetch("/api/admin/servers");
    const data = await res.json();
    setMatches(data);
    setLoading(false);
  }

  async function stopServer(matchId: string) {
    await fetch(`/api/admin/servers/${matchId}`, { method: "DELETE" });
    fetchMatches();
  }

  useEffect(() => {
    fetchMatches();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-6">
        <Card className="mx-auto max-w-5xl p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-semibold text-[var(--foreground)]">Loading admin panel...</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
      <section className="mx-auto max-w-5xl rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 shadow-2xl backdrop-blur sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <PageTitle className="text-3xl sm:text-4xl">Admin Panel</PageTitle>
            <Muted className="mt-1 text-sm sm:text-base">Monitor and manage active game servers</Muted>
          </div>
          <Button onClick={fetchMatches}>
            Refresh
          </Button>
        </div>

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