"use client";

// ── Imports ─────────────────────────────────────────────────────────

import { useMemo, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/src/app/components/ui/card";
import { Button } from "@/src/app/components/ui/button";
import { Toast } from "@/src/app/components/ui/toast";
import { Muted, PageTitle } from "@/src/app/components/ui/typography";
import { CS2_LOBBY_MODES, type LobbyModeId } from "@/src/backend/games/cs2/config/modes";

// ── Types ─────────────────────────────────────────────────────────────

const LOBBY_MODES = CS2_LOBBY_MODES;
type LobbyMode = LobbyModeId;

type Team  = "team1" | "team2" | "none";
type Phase = "waiting" | "ready_check" | "captain_pick" | "map_veto" | "starting";

interface MatchData {
  status: string;
  connectionIp?: string;
  connectionPort?: number;
  map?: string;
}

interface LobbyPlayer {
  steamId: string;
  displayName: string;
  avatarUrl?: string;
  team: Team;
  isCaptain: boolean;
  isReady: boolean;
}

interface LobbyMessage {
  steamId: string;
  displayName: string;
  text: string;
  createdAt: string;
}

interface Lobby {
  matchId: string;
  leaderId: string;
  players: LobbyPlayer[];
  messages?: LobbyMessage[];
  settings: { teamSize: number; mode: string; mapPool?: string[]; name?: string; isPublic?: boolean; workshopMapName?: string; map?: string };
  phase: Phase;
  captainPickState?: { currentTurn: Team; unpickedPlayers: string[] };
  mapVetoState?: {
    remainingMaps: string[];
    vetoHistory: { team: Team; map: string; action: "ban" | "pick" }[];
    currentTurn: Team;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<Phase, string> = {
  waiting:      "Waiting for players",
  ready_check:  "Ready check",
  captain_pick: "Captain picking",
  map_veto:     "Map veto",
  starting:     "Starting server…",
};

const MODE_LABEL: Record<string, string> = {
  use_current_teams: "Use Current Teams",
  pick_map:          "Pick Map",
  captain_pick:      "Captain Pick",
  captain_map_veto:  "Captain Pick + Map Veto",
};

const IS_DEV = process.env.NODE_ENV === "development";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LobbyPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const [lobby,      setLobby]      = useState<Lobby | null>(null);
  const [match,      setMatch]      = useState<MatchData | null>(null);
  const [mySteamId,  setMySteamId]  = useState<string | null>(null);
  const [myRole,     setMyRole]     = useState<string | null>(null);
  const [error,      setError]      = useState("");
  const [chatOpen,   setChatOpen]   = useState(false);
  const [chatDraft,  setChatDraft]  = useState("");

  // Lobby settings (controlled, synced from lobby state)
  const [settingsMode,     setSettingsMode]     = useState<LobbyMode>("use_current_teams");
  const [settingsTeamSize, setSettingsTeamSize] = useState(5);
  const [settingsSaving,   setSettingsSaving]   = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const joinedRef     = useRef(false);

  // ── Derived ─────────────────────────────────────────────────────────────

  const me         = lobby?.players.find(p => p.steamId === mySteamId);
  const isLeader   = lobby?.leaderId === mySteamId;
  const isAdmin    = myRole === "admin";
  const leader     = lobby?.players.find(p => p.steamId === lobby.leaderId);
  const team1      = useMemo(() => lobby?.players.filter(p => p.team === "team1") ?? [], [lobby?.players]);
  const team2      = useMemo(() => lobby?.players.filter(p => p.team === "team2") ?? [], [lobby?.players]);
  const unassigned = useMemo(() => lobby?.players.filter(p => p.team === "none")  ?? [], [lobby?.players]);

  const playersBySteamId = useMemo(
    () => new Map((lobby?.players ?? []).map(p => [p.steamId, p])),
    [lobby?.players],
  );

  const isServerReady  = match?.status === "ready" || match?.status === "live";
  const connectString  = match?.connectionIp && match?.connectionPort
    ? `connect ${match.connectionIp}:${match.connectionPort}` : null;
  const readyMap       = match?.map ?? lobby?.settings.workshopMapName ?? lobby?.settings.map ?? lobby?.mapVetoState?.remainingMaps?.[0] ?? lobby?.settings.mapPool?.[0];

  const isMyCaptainTurn =
    lobby?.phase === "captain_pick" &&
    me?.isCaptain &&
    me.team === lobby.captainPickState?.currentTurn;

  const isMyVetoTurn =
    lobby?.phase === "map_veto" &&
    me?.isCaptain &&
    me.team === lobby.mapVetoState?.currentTurn;

  const team1Captain = team1.find(p => p.isCaptain);
  const team2Captain = team2.find(p => p.isCaptain);
  const team1Label   = `Team ${team1Captain?.displayName ?? "1"}`;
  const team2Label   = `Team ${team2Captain?.displayName ?? "2"}`;

  const canEditSettings = lobby?.phase === "waiting" && (isLeader || isAdmin);
  const canCancel       = isLeader || isAdmin;
  const cancelLabel     = isServerReady ? "Close Server" : "Cancel Match";

  // ── Effects ──────────────────────────────────────────────────────────────

  // Sync settings form when lobby settings change
  useEffect(() => {
    if (!lobby) return;
    setSettingsMode(lobby.settings.mode as LobbyMode);
    setSettingsTeamSize(lobby.settings.teamSize);
  }, [lobby?.settings.mode, lobby?.settings.teamSize]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [lobby?.messages?.length]);

  // Join lobby once on mount
  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    fetch("/api/me")
      .then(r => r.json())
      .then(d => {
        if (!d.steamId) return;
        setMySteamId(d.steamId);
        setMyRole(d.role ?? null);
        return fetch(`/api/matches/${id}/lobby`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "join" }),
        });
      })
      .catch(() => {});
  }, [id]);

  // SSE — live lobby + match state
  useEffect(() => {
    const es = new EventSource(`/api/matches/${id}/lobby/events`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.heartbeat) return;
        if (data.closed)    { setError("This lobby has been closed."); es.close(); return; }
        if (data.__type === "matchUpdate") {
          setMatch(prev => prev ? { ...prev, ...data } : data);
          return;
        }
        setLobby(data);
      } catch { /* malformed frame */ }
    };

    es.onerror = () => setError("Lost connection to lobby. Refresh to reconnect.");

    return () => es.close();
  }, [id]);

  // Fetch match state once on mount (SSE handles subsequent updates)
  useEffect(() => {
    fetch(`/api/matches/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setMatch(data); })
      .catch(() => {});
  }, [id]);

  // Auto-advance captain pick when all players are assigned
  useEffect(() => {
    if (
      lobby?.phase === "captain_pick" &&
      isLeader &&
      unassigned.length === 0 &&
      team1.length >= (lobby.settings.teamSize ?? Infinity) &&
      team2.length >= (lobby.settings.teamSize ?? Infinity)
    ) {
      lobbyAction("captain_pick_complete");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.phase, unassigned.length, team1.length, team2.length]);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function lobbyAction(name: string, extra?: Record<string, unknown>) {
    try {
      const res  = await fetch(`/api/matches/${id}/lobby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: name, ...extra }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong");
        return false;
      }

      if (data && Array.isArray(data.players)) setLobby(data as Lobby);
      return true;
    } catch {
      setError("Request failed. Check your connection and try again.");
      return false;
    }
  }

  async function saveLobbySettings() {
    setSettingsSaving(true);
    await lobbyAction("update_settings", { settings: { mode: settingsMode, teamSize: settingsTeamSize } });
    setSettingsSaving(false);
  }

  async function cancelMatch() {
    if (!confirm("Cancel this match and close the server?")) return;
    const res  = await fetch(`/api/matches/${id}/cancel`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) router.push("/");
    else setError(data.error ?? "Failed to cancel match");
  }

  async function leaveLobby() {
    const others     = lobby?.players.filter(p => p.steamId !== mySteamId) ?? [];
    const actionName = isLeader
      ? others.length > 0 ? "leave_lobby_and_promote" : "leave_lobby_and_close"
      : "leave_lobby";
    await lobbyAction(actionName);
    router.push("/match");
  }

  async function sendChat(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    const ok = await lobbyAction("chat", { text });
    if (ok) setChatDraft("");
  }

  async function devForceReady() {
    const res = await fetch(`/api/matches/${id}/dev-ready`, { method: "POST" });
    if (res.ok) router.push(`/match/${id}`);
    else setError("Dev force-ready failed");
  }

  // ── Early returns ─────────────────────────────────────────────────────────

  if (!lobby) return (
    <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8">
      <Card className="w-full"><Muted>Connecting to lobby…</Muted></Card>
    </main>
  );

  if (!mySteamId) return (
    <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8">
      <Card className="w-full p-8 text-center">
        <Muted>You need to be logged in to view this lobby.</Muted>
        <a href="/api/auth/steam" className="mt-4 inline-block rounded-lg bg-[var(--accent)] px-6 py-2.5 font-semibold text-[var(--accent-contrast)] transition hover:brightness-110">
          Log in with Steam
        </a>
      </Card>
    </main>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      {/* Error banner */}
      {error && (
        <div className="mb-4">
          <Toast message={error} variant="error" onDismiss={() => setError("")} />
        </div>
      )}

      {/* Lobby settings */}
      {canEditSettings && (
        <section className="mb-8 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-8 shadow-2xl backdrop-blur">
          <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-[var(--foreground)]">Lobby Settings</h2>
          <p className="text-sm text-[var(--muted)]">Pick how teams are formed and how the map is chosen. For map-veto modes the map is decided in-lobby, so no map is selected here.</p>

          <div className="mt-6">
            <p className="mb-2 text-sm text-[var(--muted)]">Lobby mode</p>
            <div className="flex flex-wrap gap-2">
              {LOBBY_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setSettingsMode(mode.id)}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    settingsMode === mode.id
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <span className="text-sm text-[var(--muted)]">Players per team</span>
            <input
              type="number"
              min={1} max={10}
              value={settingsTeamSize}
              onChange={e => setSettingsTeamSize(Number(e.target.value))}
              className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={saveLobbySettings}
              disabled={settingsSaving}
              className="rounded-lg border border-[var(--accent-2)] bg-[var(--accent-2)] px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {settingsSaving ? "Saving…" : "Save Settings"}
            </button>
            <span className="text-sm text-[var(--muted)]">Changes apply immediately.</span>
          </div>
        </section>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PageTitle>{lobby.settings.name ?? (MODE_LABEL[lobby.settings.mode] ?? lobby.settings.mode)}</PageTitle>
            {lobby.settings.isPublic && (
              <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                Public
              </span>
            )}
          </div>
          <Muted className="mt-1">{PHASE_LABEL[lobby.phase]}</Muted>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Lobby leader: <span className="font-semibold text-[var(--foreground)]">{leader?.displayName ?? lobby.leaderId}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {(lobby.phase === "waiting" || lobby.phase === "ready_check") && me && !me.isReady && (
            <Button onClick={() => lobbyAction("ready")}>Ready Up</Button>
          )}
          {lobby.phase === "waiting" && isLeader && (
            <Button variant="secondary" onClick={() => lobbyAction("start_ready_check")}>
              Start Ready Check
            </Button>
          )}
          {match && canCancel && (
            <button
              onClick={cancelMatch}
              className="rounded-lg border border-[var(--danger)]/50 px-4 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
            >
              {cancelLabel}
            </button>
          )}
          {me && (
            <button
              onClick={leaveLobby}
              className="rounded-lg border border-[var(--danger)]/50 px-4 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
            >
              Leave Lobby
            </button>
          )}
        </div>
      </div>

      {/* Server creating */}
      {!isServerReady && lobby.phase === "starting" && (
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <PageTitle className="text-xl">Creating Server…</PageTitle>
          <Muted className="mt-1">Please wait while the server starts.</Muted>
          {readyMap && (
            <p className="mt-3 text-sm">Map: <span className="font-semibold text-[var(--accent)]">{readyMap}</span></p>
          )}
        </div>
      )}

      {/* Server ready */}
      {isServerReady && connectString && (
        <div className="mt-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3">
          <PageTitle className="text-xl">Server Ready</PageTitle>
          {readyMap && (
            <p className="mt-1 text-sm">Map: <span className="font-semibold text-[var(--accent)]">{readyMap}</span></p>
          )}
          <code className="mt-3 block rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
            {connectString}
          </code>
          <div className="mt-3 flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(connectString)}>Copy</Button>
            <a href={`steam://connect/${match.connectionIp}:${match.connectionPort}`}>
              <Button>Connect via Steam</Button>
            </a>
          </div>
        </div>
      )}

      {/* Captain pick banner */}
      {lobby.phase === "captain_pick" && lobby.captainPickState && (
        <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${
          isMyCaptainTurn
            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
        }`}>
          {isMyCaptainTurn
            ? "Your turn — pick a player from the unassigned pool."
            : `Waiting for ${lobby.captainPickState.currentTurn === "team1" ? "Team 1" : "Team 2"} captain to pick…`}
        </div>
      )}

      {/* Map veto banner */}
      {lobby.phase === "map_veto" && lobby.mapVetoState && (
        <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${
          isMyVetoTurn
            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
        }`}>
          {isMyVetoTurn ? "Your turn — ban a map." : `Waiting for ${lobby.mapVetoState.currentTurn === "team1" ? "Team 1" : "Team 2"} captain to ban…`}
          <div className="mt-2 flex flex-wrap gap-2">
            {lobby.mapVetoState.remainingMaps.map(map => (
              <button
                key={map}
                disabled={!isMyVetoTurn}
                onClick={() => lobbyAction("map_veto", { map, vetoAction: "ban" })}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold transition hover:border-red-500 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {map}
              </button>
            ))}
          </div>
          {lobby.mapVetoState.vetoHistory.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {lobby.mapVetoState.vetoHistory.map((v, i) => (
                <span key={i} className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400 line-through">{v.map}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dev tools */}
      {IS_DEV && isAdmin && (
        <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-400">Dev Tools</p>
          <div className="flex flex-wrap gap-2">
            {([
              ["Force Server Ready", devForceReady],
              ["Fill with Bots",     () => lobbyAction("fill_bots")],
              ["Clear Bots",         () => lobbyAction("clear_bots")],
              ["Shuffle Teams",      () => lobbyAction("shuffle")],
            ] as [string, () => void][]).map(([label, fn]) => (
              <button
                key={label}
                onClick={fn}
                className="rounded border border-yellow-500 px-3 py-1.5 text-xs font-semibold text-yellow-400 transition hover:bg-yellow-500 hover:text-black"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Team grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TeamPanel
          label={team1Label} team="team1" players={team1}
          teamSize={lobby.settings.teamSize} mySteamId={mySteamId}
          isLeader={isLeader} isAdmin={isAdmin} phase={lobby.phase}
          myTeam={me?.team ?? "none"} isMyCaptainTurn={!!isMyCaptainTurn}
          leaderId={lobby.leaderId}
          onJoin={()             => lobbyAction("join_team", { team: "team1" })}
          onLeaveTeam={()        => lobbyAction("leave_team")}
          onSetCaptain={steamId  => lobbyAction("set_captain", { targetSteamId: steamId })}
          onKick={steamId        => lobbyAction("kick_player", { targetSteamId: steamId })}
          onTransferLeader={sid  => lobbyAction("transfer_leader", { targetSteamId: sid })}
          onCaptainPick={steamId => lobbyAction("captain_pick", { pickedSteamId: steamId })}
        />

        {/* Unassigned */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Unassigned</p>
            <span className="text-xs text-[var(--muted)]">{unassigned.length}</span>
          </div>
          {unassigned.length === 0
            ? <Muted className="text-xs">—</Muted>
            : unassigned.map(p => (
                <PlayerRow
                  key={p.steamId} player={p}
                  isMe={p.steamId === mySteamId}
                  isLeader={isLeader} isAdmin={isAdmin}
                  showCaptainToggle={false}
                  pickable={!!isMyCaptainTurn}
                  onPick={()           => lobbyAction("captain_pick", { pickedSteamId: p.steamId })}
                  onSetCaptain={()     => {}}
                  onKick={()           => lobbyAction("kick_player", { targetSteamId: p.steamId })}
                  onTransferLeader={() => lobbyAction("transfer_leader", { targetSteamId: p.steamId })}
                  leaderId={lobby.leaderId}
                />
              ))
          }
        </div>

        <TeamPanel
          label={team2Label} team="team2" players={team2}
          teamSize={lobby.settings.teamSize} mySteamId={mySteamId}
          isLeader={isLeader} isAdmin={isAdmin} phase={lobby.phase}
          myTeam={me?.team ?? "none"} isMyCaptainTurn={!!isMyCaptainTurn}
          leaderId={lobby.leaderId}
          onJoin={()             => lobbyAction("join_team", { team: "team2" })}
          onLeaveTeam={()        => lobbyAction("leave_team")}
          onSetCaptain={steamId  => lobbyAction("set_captain", { targetSteamId: steamId })}
          onKick={steamId        => lobbyAction("kick_player", { targetSteamId: steamId })}
          onTransferLeader={sid  => lobbyAction("transfer_leader", { targetSteamId: sid })}
          onCaptainPick={steamId => lobbyAction("captain_pick", { pickedSteamId: steamId })}
        />
      </div>

      {/* Map pool */}
      {lobby.phase === "waiting" && (lobby.settings.mapPool?.length ?? 0) > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Map Pool</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lobby.settings.mapPool!.map(map => (
              <span key={map} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
                {map}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="fixed bottom-6 right-4 z-50 sm:bottom-5 sm:right-5">
        <div className="relative flex w-[min(92vw,360px)] flex-col items-end gap-3">
          {chatOpen && (
            <section className="absolute bottom-full mb-3 flex h-[50vh] w-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 shadow-2xl backdrop-blur">
              <div ref={chatScrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
                {(lobby.messages ?? []).map((msg, i) => {
                  const sender = playersBySteamId.get(msg.steamId);
                  const name   = sender?.displayName ?? msg.displayName;
                  const avatar = sender?.avatarUrl;
                  const time   = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                  return (
                    <article key={i} className="flex gap-3 px-1 py-1">
                      {avatar
                        ? <img src={avatar} alt="" className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover" />
                        : <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-xs font-semibold text-[var(--foreground)]/70">
                            {name[0].toUpperCase()}
                          </div>
                      }
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-[var(--foreground)]/90">
                            <span className="font-semibold text-[var(--foreground)]">{name}: </span>
                            {msg.text}
                          </p>
                          <span className="shrink-0 pt-0.5 text-[11px] text-[var(--muted)]">{time}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <form onSubmit={sendChat} className="flex items-end gap-2 border-t border-[var(--border)] p-3">
                <textarea
                  value={chatDraft}
                  onChange={e => setChatDraft(e.target.value)}
                  maxLength={200} rows={2}
                  placeholder="Message"
                  className="min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <button
                  type="submit"
                  disabled={!chatDraft.trim()}
                  className="h-10 shrink-0 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-contrast)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send
                </button>
              </form>
            </section>
          )}

          <button
            onClick={() => setChatOpen(o => !o)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-contrast)] shadow-lg transition hover:brightness-110"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3v-5.5A8.5 8.5 0 1 1 21 11.5Z" />
            </svg>
            {chatOpen ? "Hide Chat" : "Chat"}
          </button>
        </div>
      </div>
    </main>
  );
}

// ── TeamPanel ─────────────────────────────────────────────────────────────────

function TeamPanel({
  label, team, players, teamSize, mySteamId, isLeader, isAdmin,
  phase, myTeam, isMyCaptainTurn, onJoin, onLeaveTeam, onSetCaptain,
  onKick, onCaptainPick, leaderId, onTransferLeader,
}: {
  label: string;
  team: Team;
  players: LobbyPlayer[];
  teamSize: number;
  mySteamId: string | null;
  isLeader: boolean;
  isAdmin: boolean;
  phase: Phase;
  myTeam: Team;
  isMyCaptainTurn: boolean;
  onJoin: () => void;
  onLeaveTeam: () => void;
  onSetCaptain: (steamId: string) => void;
  onKick: (steamId: string) => void;
  onCaptainPick: (steamId: string) => void;
  leaderId: string;
  onTransferLeader: (steamId: string) => void;
}) {
  const canJoin    = phase === "waiting" && myTeam !== team && players.length < teamSize;
  const amOnThisTeam = myTeam === team;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</p>
        <span className="text-xs text-[var(--muted)]">{players.length}/{teamSize}</span>
      </div>

      {(isLeader || isAdmin) && (
        <p className="text-[11px] text-[var(--muted)]">Use the captain button on a player to reassign that team's captain.</p>
      )}

      {players.map(p => (
        <PlayerRow
          key={p.steamId} player={p}
          isMe={p.steamId === mySteamId}
          isLeader={isLeader} isAdmin={isAdmin}
          showCaptainToggle={phase === "waiting" && (isLeader || isAdmin)}
          pickable={false}
          onPick={()           => {}}
          onSetCaptain={()     => onSetCaptain(p.steamId)}
          onKick={()           => onKick(p.steamId)}
          onTransferLeader={() => onTransferLeader(p.steamId)}
          leaderId={leaderId}
          extraAction={
            p.steamId === mySteamId && amOnThisTeam && phase === "waiting"
              ? { label: "Leave team", onClick: onLeaveTeam }
              : undefined
          }
        />
      ))}

      {Array.from({ length: Math.max(0, teamSize - players.length) }).map((_, i) => (
        <div key={i} className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2.5 text-xs text-[var(--muted)]">
          Empty slot
        </div>
      ))}

      {canJoin && (
        <button
          onClick={onJoin}
          className="mt-1 rounded-lg border border-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
        >
          Join {label}
        </button>
      )}
    </div>
  );
}

// ── PlayerRow ─────────────────────────────────────────────────────────────────

function PlayerRow({
  player, isMe, isLeader, isAdmin, showCaptainToggle, pickable,
  onPick, onSetCaptain, extraAction, onKick, leaderId, onTransferLeader,
}: {
  player: LobbyPlayer;
  isMe: boolean;
  isLeader: boolean;
  isAdmin: boolean;
  showCaptainToggle: boolean;
  pickable: boolean;
  onPick: () => void;
  onSetCaptain: () => void;
  extraAction?: { label: string; onClick: () => void };
  onKick: () => void;
  leaderId: string;
  onTransferLeader: () => void;
}) {
  const canManage = isLeader || isAdmin;

  return (
    <div className={`group flex min-h-[96px] flex-col justify-between rounded-lg border px-3 py-2.5 text-sm transition ${
      isMe ? "border-[var(--accent)]/40 bg-[var(--accent)]/10" : "border-[var(--border)] bg-[var(--surface)]"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {player.avatarUrl
            ? <img src={player.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" />
            : <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--surface-hover)]" />
          }
          <p className="min-w-0 truncate font-medium text-[var(--foreground)]">{player.displayName}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          player.isReady
            ? "border-green-500/40 bg-green-500/10 text-green-400"
            : "border-[var(--border)] text-[var(--muted)]"
        }`}>
          {player.isReady ? "Ready" : "Not ready"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="flex min-h-5 flex-wrap items-center gap-1.5">
          {player.isCaptain && (
            <span className="rounded-full border border-[var(--accent)]/40 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">Captain</span>
          )}
          {player.steamId === leaderId && (
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--foreground)]/70">Leader</span>
          )}
        </div>

        <div className="flex min-h-5 flex-wrap items-center justify-end gap-1.5">
          {showCaptainToggle && !player.isCaptain && (
            <button
              onClick={onSetCaptain}
              className="rounded-full border border-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
            >
              Make captain
            </button>
          )}
          {canManage && !isMe && (
            <button
              onClick={onKick}
              className="rounded px-1.5 py-0.5 text-[11px] text-[var(--muted)] transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
            >
              Kick
            </button>
          )}
          {canManage && player.steamId !== leaderId && (
            <button
              onClick={onTransferLeader}
              className="rounded px-1.5 py-0.5 text-[11px] text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              Give leader
            </button>
          )}
          {pickable && player.team === "none" && (
            <button
              onClick={onPick}
              className="rounded border border-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
            >
              Pick
            </button>
          )}
          {extraAction && (
            <button
              onClick={extraAction.onClick}
              className="rounded px-1.5 py-0.5 text-[11px] text-[var(--muted)] transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
            >
              {extraAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}