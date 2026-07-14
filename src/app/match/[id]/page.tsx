"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/src/app/components/ui/button";
import { Card } from "@/src/app/components/ui/card";
import { Toast } from "@/src/app/components/ui/toast";
import { Muted, PageTitle } from "@/src/app/components/ui/typography";

interface MatchData {
  status: string;
  connectionIp?: string;
  connectionPort?: number;
  map?: string;
  mode?: string;
  isOwner?: boolean;
  isAdmin?: boolean;
  canCancel?: boolean;
}

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const es = new EventSource(`/api/matches/${id}/events`);

    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.error) {
          setError(d.error);
          return;
        }
        if (d.heartbeat) return;

        if (d.__type === "matchUpdate") {
          setMatch((prev) =>
            prev
              ? {
                  ...prev,
                  status: d.status,
                  connectionIp: d.connectionIp ?? prev.connectionIp,
                  connectionPort: d.connectionPort ?? prev.connectionPort,
                  map: d.map ?? prev.map,
                }
              : prev
          );
          if (d.status === "finished" || d.status === "cancelled") es.close();
          return;
        }

        // Initial full view
        setMatch(d);
        if (d.status === "finished" || d.status === "cancelled") es.close();
      } catch {
        // ignore malformed frame
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here.
    };

    return () => es.close();
  }, [id]);

  if (!match) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full">
          {error && (
            <div className="mb-4">
              <Toast message={error} variant="error" onDismiss={() => setError("")} />
            </div>
          )}
          <Muted>Loading...</Muted>
        </Card>
      </main>
    );
  }

  if (match.status === "cancelled") {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full">
          {error && (
            <div className="mb-4">
              <Toast message={error} variant="error" onDismiss={() => setError("")} />
            </div>
          )}
          <PageTitle className="text-2xl">Match Cancelled</PageTitle>
          <Muted className="mt-2">This match was cancelled before the server became playable.</Muted>
        </Card>
      </main>
    );
  }

  if (match.status === "pending" || match.status === "configuring") {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full">
          {error && (
            <div className="mb-4">
              <Toast message={error} variant="error" onDismiss={() => setError("")} />
            </div>
          )}
          <PageTitle className="text-2xl">Creating Server...</PageTitle>
          <Muted className="mt-2">Please wait while your server is being set up. This usually takes about a minute.</Muted>
          <p className="mt-4 text-sm text-[var(--foreground)]">
            Map: <span className="font-semibold text-[var(--accent)]">{match.map}</span>
          </p>
        </Card>
      </main>
    );
  }

  if (match.status === "ready" || match.status === "live") {
    const connectString = `connect ${match.connectionIp}:${match.connectionPort}`;
    const steamUrl = `steam://connect/${match.connectionIp}:${match.connectionPort}`;

    return (
      <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full">
          {error && (
            <div className="mb-4">
              <Toast message={error} variant="error" onDismiss={() => setError("")} />
            </div>
          )}
          <PageTitle className="text-2xl">Server Ready!</PageTitle>
          <p className="mt-3 text-sm text-[var(--foreground)]">
            Map: <span className="font-semibold text-[var(--accent)]">{match.map}</span>
          </p>
          <code className="mt-4 block rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]">
            {connectString}
          </code>
          <div className="mt-4 flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(connectString)}>
              Copy
            </Button>
            <a href={steamUrl}>
              <Button>Connect via Steam</Button>
            </a>
            {match.canCancel && (
              <Button
                className="ml-2 bg-red-600 text-white"
                onClick={async () => {
                  if (!confirm("Cancel this match and stop the server?")) return;
                  try {
                    const res = await fetch(`/api/matches/${id}/cancel`, { method: "POST" });
                    if (res.ok) {
                      setMatch(prev => prev ? { ...prev, status: "cancelled" } : prev);
                    } else {
                      setError("Failed to cancel match");
                    }
                  } catch {
                    setError("Failed to cancel match");
                  }
                }}
              >
                Cancel Match
              </Button>
            )}
          </div>
        </Card>
      </main>
    );
  }

  return null;
}