"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/src/app/components/ui/card";
import { Button } from "@/src/app/components/ui/button";
import { Toast } from "@/src/app/components/ui/toast";
import { PageTitle, Muted } from "@/src/app/components/ui/typography";

interface LobbyEntry {
  matchId: string;
  name?: string;
  mode: string;
  teamSize: number;
  playerCount: number;
  capacity: number;
  hasPassword: boolean;
  leaderName: string;
  leaderAvatar?: string;
  workshopMapName?: string;
  createdAt: string;
}

const MODE_LABEL: Record<string, string> = {
  use_current_teams: "Use Current Teams",
  pick_map: "Pick Map",
  captain_pick: "Captain Pick",
  captain_map_veto: "Captain Pick + Map Veto",
};

export default function LobbiesPage() {
  const router = useRouter();
  const [lobbies, setLobbies] = useState<LobbyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; variant: "error" | "success" } | null>(null);
  const [passwordModal, setPasswordModal] = useState<{ matchId: string; name: string } | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => setLoggedIn(!!d.steamId))
      .catch(() => setLoggedIn(false));
  }, []);

  const fetchLobbies = useCallback(async () => {
    try {
      const res = await fetch("/api/lobbies");
      if (res.ok) {
        const data = await res.json();
        setLobbies(data.lobbies);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchLobbies();
    const interval = setInterval(fetchLobbies, 10000);
    return () => clearInterval(interval);
  }, [fetchLobbies]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function joinLobby(matchId: string, password?: string) {
    setJoining(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/lobby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/match/${matchId}/lobby`);
      } else {
        setToast({ message: data.error ?? "Failed to join lobby", variant: "error" });
      }
    } catch {
      setToast({ message: "Failed to join lobby", variant: "error" });
    }
    setJoining(false);
    setPasswordModal(null);
    setPasswordInput("");
  }

  function handleJoin(lobby: LobbyEntry) {
    if (lobby.hasPassword) {
      setPasswordModal({ matchId: lobby.matchId, name: lobby.name ?? `${lobby.leaderName}'s Lobby` });
    } else {
      joinLobby(lobby.matchId);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-5xl items-center justify-center px-4 py-8">
        <Card className="w-full"><Muted>Loading lobbies…</Muted></Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {toast && (
        <div className="mb-4">
          <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Public Lobbies</PageTitle>
        {loggedIn && (
          <Button variant="secondary" onClick={() => router.push("/match/new/cs2")}>
            Create Lobby
          </Button>
        )}
      </div>

      {!loggedIn && !loading && (
        <Card className="mb-4 p-6 text-center">
          <p className="text-sm text-[var(--muted)]">
            <a href="/api/auth/steam" className="font-semibold text-[var(--accent)] underline">Log in with Steam</a> to create or join lobbies.
          </p>
        </Card>
      )}

      {lobbies.length === 0 ? (
        <Card className="p-12 text-center">
          <Muted>{loggedIn ? "No public lobbies available. Create one!" : "No public lobbies available."}</Muted>
        </Card>
      ) : (
        <div className="grid gap-4">
          {lobbies.map((lobby) => (
            <article
              key={lobby.matchId}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 shadow-md transition hover:bg-[var(--surface-hover)]/70 hover:shadow-lg sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-lg font-semibold text-[var(--foreground)]">
                      {lobby.name ?? `${lobby.leaderName}'s Lobby`}
                    </p>
                    {lobby.hasPassword && (
                      <span className="shrink-0 rounded-full border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)]">
                        Private
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {MODE_LABEL[lobby.mode] ?? lobby.mode}
                    {lobby.workshopMapName && <span className="ml-2">· {lobby.workshopMapName}</span>}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Hosted by <span className="font-semibold text-[var(--foreground)]">{lobby.leaderName}</span>
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-lg font-bold tabular-nums text-[var(--accent)]">
                      {lobby.playerCount}<span className="text-sm font-normal text-[var(--muted)]">/{lobby.capacity}</span>
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">Players</p>
                  </div>
                  {loggedIn ? (
                    <Button onClick={() => handleJoin(lobby)}>
                      Join
                    </Button>
                  ) : (
                    <a href="/api/auth/steam" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-hover)]">
                      Log in to join
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Password modal */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm p-6">
            <h3 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
              Join {passwordModal.name}
            </h3>
            <p className="mb-4 text-sm text-[var(--muted)]">This lobby requires a password.</p>
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && passwordInput.trim()) joinLobby(passwordModal.matchId, passwordInput); }}
              placeholder="Enter password"
              autoFocus
              className="mb-4 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setPasswordModal(null); setPasswordInput(""); }}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <Button
                onClick={() => joinLobby(passwordModal.matchId, passwordInput)}
                disabled={!passwordInput.trim() || joining}
              >
                {joining ? "Joining…" : "Join"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
