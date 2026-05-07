"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/src/app/components/ui/button";
import { Card } from "@/src/app/components/ui/card";
import { Muted, PageTitle } from "@/src/app/components/ui/typography";

interface MatchData {
  status: string;
  connectionIp?: string;
  connectionPort?: number;
  gameConfig?: {
    map: string;
    mode: string;
  };
  isOwner?: boolean;
  isAdmin?: boolean;
}

export default function MatchPage() {
  const { id } = useParams();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
  
    const fetchMatch = async () => {
      try {
        const res = await fetch(`/api/matches/${id}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Match not found");
          return;
        }

        setMatch(data);
        return data.status;
      } catch {
        
      }
    };

    // Fetch immediately on load
    fetchMatch();

    // Poll every 3 seconds until match is live or ended
    const interval = setInterval(async () => {
      const status = await fetchMatch();
      if (status === "live" || status === "cancelled" || status === "finished") {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full border-[var(--danger)]/35 bg-[var(--danger)]/10">
          <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
        </Card>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full">
          <Muted>Loading...</Muted>
        </Card>
      </main>
    );
  }

  if (match.status === "cancelled") {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full">
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
          <PageTitle className="text-2xl">Creating Server...</PageTitle>
          <Muted className="mt-2">Please wait while your server is being set up. This usually takes about a minute.</Muted>
          <p className="mt-4 text-sm text-[var(--foreground)]">Map: <span className="font-semibold text-[var(--accent)]">{match.gameConfig?.map}</span></p>
        </Card>
      </main>
    );
  }

  if (match.status === "ready" || match.status === "live") {
    const connectString = `connect ${match.connectionIp}:${match.connectionPort}`;
    const steamUrl = `steam://connect/${connectString}`;

    return (
      <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full">
          <PageTitle className="text-2xl">Server Ready!</PageTitle>
          <p className="mt-3 text-sm text-[var(--foreground)]">Map: <span className="font-semibold text-[var(--accent)]">{match.gameConfig?.map}</span></p>
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
            {(match.isOwner || match.isAdmin) && (
              <Button className="ml-2 bg-red-600 text-white" onClick={async () => {
                if (!confirm('Cancel this match and stop the server?')) return;
                try {
                  const res = await fetch(`/api/matches/${id}/cancel`, { method: 'POST' });
                  if (res.ok) {
                    setMatch(prev => prev ? { ...prev, status: 'cancelled' } : prev);
                  } else {
                    alert('Failed to cancel');
                  }
                } catch (err) {
                  alert('Failed to cancel');
                }
              }}>Cancel Match</Button>
            )}
          </div>
        </Card>
      </main>
    );
  }

  return null;
}