"use client";

import { useEffect, useState } from "react";

interface Match {
  _id: string;
  gameType?: string;
  status: string;
  gameConfig: { map: string; mode: string };
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
      return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
    }
    if (normalized === "stopping" || normalized === "pending") {
      return "bg-amber-500/15 text-amber-200 border-amber-400/30";
    }
    return "bg-slate-500/20 text-slate-200 border-slate-400/30";
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
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-slate-700 bg-slate-900/70 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-semibold text-slate-100">Loading admin panel...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
      <section className="mx-auto max-w-5xl rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow-2xl backdrop-blur sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">Admin Panel</h1>
            <p className="mt-1 text-sm text-slate-300 sm:text-base">Monitor and manage active game servers</p>
          </div>
          <button
            onClick={fetchMatches}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Refresh
          </button>
        </div>

        <h2 className="mb-4 text-xl font-semibold text-slate-100">Active Servers</h2>

        {matches.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800/40 p-8 text-center text-slate-300">
            No active servers
          </div>
        )}

        <div className="grid gap-4">
          {matches.map((match) => (
            <article
              key={match._id}
              className="rounded-xl border border-slate-700 bg-slate-800/70 p-4 shadow-md transition hover:border-slate-600 hover:shadow-lg sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-slate-100">{match.gameConfig.map}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Server: <span className="font-semibold text-cyan-300">{getServerName(match)}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {match.connectionIp}:{match.connectionPort}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusClasses(match.status)}`}
                >
                  {match.status}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-end">
                <button
                  onClick={() => stopServer(match._id)}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
                >
                  Stop Server
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}