// Lobby modes for create match UI
const LOBBY_MODES = [
  { id: "use_current_teams", label: "Use Current Teams" },
  { id: "captain_pick",      label: "Captain Pick" },
  { id: "captain_map_veto",  label: "Captain Map Veto" },
  { id: "pick_map",          label: "Pick Map" },
] as const;
type LobbyMode = (typeof LOBBY_MODES)[number]["id"];
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/src/app/components/ui/card";
import { Button } from "@/src/app/components/ui/button";
import { Muted, PageTitle } from "@/src/app/components/ui/typography";

// ── Types ─────────────────────────────────────────────────────────────────────

type Team = "team1" | "team2" | "none";
type Phase = "waiting" | "ready_check" | "captain_pick" | "map_veto" | "starting";

interface MatchData {
  status: string;
  connectionIp?: string;
  connectionPort?: number;
  map?: string;
  mode?: string;
}

interface LobbyPlayer {
  steamId: string;
  displayName: string;
  avatarUrl?: string;
  team: Team;
  isCaptain: boolean;
  isReady: boolean;
}

interface Lobby {
  matchId: string;
  leaderId: string;
  players: LobbyPlayer[];
  settings: { teamSize: number; mode: string; mapPool?: string[] };
  phase: Phase;
  coinFlipWinner?: "team1" | "team2";
  captainPickState?: { currentTurn: "team1" | "team2"; unpickedPlayers: string[] };
  mapVetoState?: {
    remainingMaps: string[];
    vetoHistory: { team: "team1" | "team2"; map: string; action: "ban" | "pick" }[];
    currentTurn: "team1" | "team2";
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
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [match, setMatch] = useState<MatchData | null>(null);
  const [mySteamId, setMySteamId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [error, setError] = useState("");
  const joinedRef = useRef(false);

  // Create Match UI state
  const [lobbyMode, setLobbyMode] = useState<LobbyMode>("use_current_teams");
  const [teamSize, setTeamSize] = useState(5);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  async function createMatch() {
    setCreateLoading(true);
    setCreateError("");
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "cs2", lobbyMode, teamSize }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Something went wrong");
        return;
      }
      router.push(`/match/${data.matchId}/lobby`);
    } catch {
      setCreateError("Failed to create match");
    } finally {
      setCreateLoading(false);
    }
  }

  // Join once on mount
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

  // Auto-leave when tab/window closes
  useEffect(() => {
    const handleUnload = () => {
      // Intentionally do not remove players on unload to allow quick reconnects
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [id]);

  // SSE — live lobby state
  useEffect(() => {
    const es = new EventSource(`/api/matches/${id}/lobby/events`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.closed) { setError("This lobby has been closed."); es.close(); return; }
        setLobby(data);
      } catch { /* malformed frame */ }
    };
    es.onerror = () => { setError("Lost connection to lobby. Refresh to reconnect."); es.close(); };
    return () => es.close();
  }, [id]);

  // Match state — server start / ready state
  useEffect(() => {
    let active = true;

    const fetchMatch = async () => {
      try {
        const res = await fetch(`/api/matches/${id}`);
        const data = await res.json();
        if (!active || !res.ok) return;
        setMatch(data);
      } catch {
        // next poll will retry
      }
    };

    fetchMatch();

    const interval = setInterval(fetchMatch, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const me       = lobby?.players.find(p => p.steamId === mySteamId);
  const isLeader = lobby?.leaderId === mySteamId;
  const isAdmin  = myRole === "admin";
  const team1    = lobby?.players.filter(p => p.team === "team1") ?? [];
  const team2    = lobby?.players.filter(p => p.team === "team2") ?? [];
  const unassigned = lobby?.players.filter(p => p.team === "none") ?? [];
  const isServerReady = match?.status === "ready" || match?.status === "live";
  const connectString = match?.connectionIp && match?.connectionPort
    ? `connect ${match.connectionIp}:${match.connectionPort}`
    : null;
  const readyMap = match?.map ?? lobby?.mapVetoState?.remainingMaps?.[0] ?? lobby?.settings.mapPool?.[0];

  const isMyCaptainTurn =
    lobby?.phase === "captain_pick" &&
    lobby.captainPickState?.currentTurn &&
    me?.isCaptain &&
    me.team === lobby.captainPickState.currentTurn;

  const isMyVetoTurn =
    lobby?.phase === "map_veto" &&
    lobby.mapVetoState?.currentTurn &&
    me?.isCaptain &&
    me.team === lobby.mapVetoState.currentTurn;

  // Auto-advance captain pick when teams are full and no unassigned players remain
  useEffect(() => {
    if (
      lobby?.phase === "captain_pick" &&
      isLeader &&
      unassigned.length === 0 &&
      team1.length >= (lobby?.settings.teamSize ?? Infinity) &&
      team2.length >= (lobby?.settings.teamSize ?? Infinity)
    ) {
      action("captain_pick_complete");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.phase, unassigned.length, team1.length, team2.length]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function action(name: string, extra?: Record<string, unknown>) {
    const res = await fetch(`/api/matches/${id}/lobby`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: name, ...extra }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
    }
  }

  async function leaveLobby() {
    const isLeader = lobby?.leaderId === mySteamId;
    const otherPlayers = lobby?.players.filter(p => p.steamId !== mySteamId) ?? [];
    const actionName = isLeader
      ? otherPlayers.length > 0 ? "leave_lobby_and_promote" : "leave_lobby_and_close"
      : "leave_lobby";
    await action(actionName);
    router.push("/match");
  }

  async function devForceReady() {
    const res = await fetch(`/api/matches/${id}/dev-ready`, { method: "POST" });
    if (res.ok) router.push(`/match/${id}`);
    else setError("Dev force-ready failed");
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (error) return (
    <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8">
      <Card className="w-full border-[var(--danger)]/35 bg-[var(--danger)]/10">
        <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
      </Card>
    </main>
  );

  if (!lobby) return (
    <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-2xl items-center justify-center px-4 py-8">
      <Card className="w-full"><Muted>Connecting to lobby…</Muted></Card>
    </main>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  // Show create match UI only for leader, phase waiting
  const showCreateMatch = lobby && lobby.leaderId === mySteamId && lobby.phase === "waiting";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      {showCreateMatch && (
        <section className="mb-8 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-8 shadow-2xl backdrop-blur">
          <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--foreground)] mb-2">Create Match</h2>
          <div className="mb-4"><span className="text-sm text-[var(--muted)]">Lobby mode</span></div>
          <div className="flex flex-wrap gap-2 mb-4">
            {LOBBY_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setLobbyMode(mode.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  lobbyMode === mode.id
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="mb-4">
            <span className="text-sm text-[var(--muted)]">Players per team</span>
            <input
              type="number"
              min={1}
              max={10}
              value={teamSize}
              onChange={e => setTeamSize(Number(e.target.value))}
              className="ml-2 w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          {createError && <p className="text-sm text-red-400 mb-2">{createError}</p>}
          <button
            onClick={createMatch}
            disabled={createLoading}
            className="rounded-lg border border-[var(--accent-2)] bg-[var(--accent-2)] px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createLoading ? "Creating..." : "Create CS2 Match"}
          </button>
        </section>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle>{MODE_LABEL[lobby.settings.mode] ?? lobby.settings.mode}</PageTitle>
          <Muted className="mt-1">{PHASE_LABEL[lobby.phase]}</Muted>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {(lobby.phase === "waiting" || lobby.phase === "ready_check") && me && !me.isReady && (
            <Button onClick={() => action("ready")}>Ready Up</Button>
          )}
          {lobby.phase === "waiting" && isLeader && (
            <Button variant="secondary" onClick={() => action("start_ready_check")}>
              Start Ready Check
            </Button>
          )}
          <button
            onClick={leaveLobby}
            className="rounded-lg border border-[var(--danger)]/50 px-4 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
          >
            Leave Lobby
          </button>
        </div>
      </div>

      {match && !isServerReady && lobby.phase === "starting" && (match.status === "pending" || match.status === "configuring") && (
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <PageTitle className="text-xl">Creating Server...</PageTitle>
          <Muted className="mt-1">Please wait while the server starts.</Muted>
          {readyMap && (
            <p className="mt-3 text-sm text-[var(--foreground)]">
              Map: <span className="font-semibold text-[var(--accent)]">{readyMap}</span>
            </p>
          )}
        </div>
      )}

      {isServerReady && connectString && (
        <div className="mt-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3">
          <PageTitle className="text-xl">Server Ready</PageTitle>
          {readyMap && (
            <p className="mt-1 text-sm text-[var(--foreground)]">
              Map: <span className="font-semibold text-[var(--accent)]">{readyMap}</span>
            </p>
          )}
          <code className="mt-3 block rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]">
            {connectString}
          </code>
          <div className="mt-3 flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(connectString)}>
              Copy
            </Button>
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
          {isMyVetoTurn
            ? "Your turn — ban a map."
            : `Waiting for ${lobby.mapVetoState.currentTurn === "team1" ? "Team 1" : "Team 2"} captain to ban…`}
          <div className="mt-2 flex flex-wrap gap-2">
            {lobby.mapVetoState.remainingMaps.map(map => (
              <button
                key={map}
                disabled={!isMyVetoTurn}
                onClick={() => action("map_veto", { map, vetoAction: "ban" })}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold transition hover:border-red-500 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {map}
              </button>
            ))}
          </div>
          {lobby.mapVetoState.vetoHistory.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {lobby.mapVetoState.vetoHistory.map((v, i) => (
                <span key={i} className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400 line-through">
                  {v.map}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dev panel */}
      {IS_DEV && isAdmin && (
        <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-400">Dev Tools</p>
          <div className="flex flex-wrap gap-2">
            {(["Force Server Ready", "Fill with Bots", "Clear Bots", "Shuffle Teams"] as const).map((label) => {
              const actionMap: Record<string, string> = {
                "Force Server Ready": "__dev_ready",
                "Fill with Bots": "fill_bots",
                "Clear Bots": "clear_bots",
                "Shuffle Teams": "shuffle",
              };
              return (
                <button
                  key={label}
                  onClick={() => label === "Force Server Ready" ? devForceReady() : action(actionMap[label])}
                  className="rounded border border-yellow-500 px-3 py-1.5 text-xs font-semibold text-yellow-400 transition hover:bg-yellow-500 hover:text-black"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main grid: Team 1 | Unassigned | Team 2 */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Team 1 */}
        <TeamPanel
          label="Team 1"
          team="team1"
          players={team1}
          teamSize={lobby.settings.teamSize}
          mySteamId={mySteamId}
          isLeader={isLeader}
          phase={lobby.phase}
          myTeam={me?.team ?? "none"}
          isMyCaptainTurn={!!isMyCaptainTurn}
          onJoin={() => action("join_team", { team: "team1" })}
          onLeaveTeam={() => action("leave_team")}
          onSetCaptain={(steamId) => action("set_captain", { targetSteamId: steamId })}
          isAdmin={isAdmin}
          onKick={(steamId) => action("kick_player", { targetSteamId: steamId })}
          onCaptainPick={(steamId) => action("captain_pick", { pickedSteamId: steamId })}
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
                  key={p.steamId}
                  player={p}
                  isMe={p.steamId === mySteamId}
                  isLeader={isLeader}
                  showCaptainToggle={false}
                  pickable={!!isMyCaptainTurn}
                  onPick={() => action("captain_pick", { pickedSteamId: p.steamId })}
                  onSetCaptain={() => {}}
                  showKickToggle={isLeader || isAdmin}
                  onKick={() => action("kick_player", { targetSteamId: p.steamId })}
                />
              ))
          }
        </div>

        {/* Team 2 */}
        <TeamPanel
          label="Team 2"
          team="team2"
          players={team2}
          teamSize={lobby.settings.teamSize}
          mySteamId={mySteamId}
          isLeader={isLeader}
          phase={lobby.phase}
          myTeam={me?.team ?? "none"}
          isMyCaptainTurn={!!isMyCaptainTurn}
          onJoin={() => action("join_team", { team: "team2" })}
          onLeaveTeam={() => action("leave_team")}
          onSetCaptain={(steamId) => action("set_captain", { targetSteamId: steamId })}
          isAdmin={isAdmin}
          onKick={(steamId) => action("kick_player", { targetSteamId: steamId })}
          onCaptainPick={(steamId) => action("captain_pick", { pickedSteamId: steamId })}
        />
      </div>

      {/* Map pool (waiting/ready phases only) */}
      {lobby.settings.mapPool && lobby.settings.mapPool.length > 0 && lobby.phase === "waiting" && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Map Pool</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lobby.settings.mapPool.map(map => (
              <span key={map} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
                {map}
              </span>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// ── TeamPanel ─────────────────────────────────────────────────────────────────

function TeamPanel({
  label, team, players, teamSize, mySteamId, isLeader, isAdmin,
  phase, myTeam, isMyCaptainTurn,
  onJoin, onLeaveTeam, onSetCaptain, onKick, onCaptainPick,
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
}) {
  const canJoin = phase === "waiting" && myTeam !== team;
  const amOnThisTeam = myTeam === team;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</p>
        <span className="text-xs text-[var(--muted)]">{players.length}/{teamSize}</span>
      </div>

      {players.map(p => (
        <PlayerRow
          key={p.steamId}
          player={p}
          isMe={p.steamId === mySteamId}
          isLeader={isLeader}
          showCaptainToggle={isLeader && phase === "waiting"}
          pickable={false}
          onPick={() => {}}
          onSetCaptain={() => onSetCaptain(p.steamId)}
          showKickToggle={isLeader || isAdmin}
          onKick={() => onKick(p.steamId)}
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

      {canJoin && phase === "waiting" && (
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
  player, isMe, isLeader, showCaptainToggle, pickable, onPick, onSetCaptain, extraAction, showKickToggle, onKick,
}: {
  player: LobbyPlayer;
  isMe: boolean;
  isLeader: boolean;
  showCaptainToggle: boolean;
  pickable: boolean;
  onPick: () => void;
  onSetCaptain: () => void;
  extraAction?: { label: string; onClick: () => void };
  showKickToggle?: boolean;
  onKick?: () => void;
}) {
  return (
    <div className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
      isMe
        ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
        : "border-[var(--border)] bg-[var(--surface)]"
    }`}>
      {player.avatarUrl
        ? <img src={player.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full" />
        : <div className="h-7 w-7 shrink-0 rounded-full bg-[var(--surface-hover)]" />
      }

      <span className="min-w-0 flex-1 font-medium text-[var(--foreground)]">
        <span className="block truncate">{player.displayName}</span>
        {player.isCaptain && (
          <span className="text-xs font-normal text-[var(--accent)]">Captain</span>
        )}
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* Ready indicator */}
        <span className={`text-xs font-semibold ${player.isReady ? "text-green-400" : "text-[var(--muted)]"}`}>
          {player.isReady ? "Ready" : "Not ready"}
        </span>

        {/* Leader: assign captain */}
        {showCaptainToggle && (
          <button
            onClick={onSetCaptain}
            title={player.isCaptain ? "Remove captain" : "Make captain"}
            className="rounded px-1.5 py-0.5 text-xs text-[var(--muted)] opacity-0 transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] group-hover:opacity-100"
          >
            {player.isCaptain ? "★" : "☆"}
          </button>
        )}

        {/* Kick player (leader/admin) */}
        {showKickToggle && !isMe && onKick && (
          <button
            onClick={onKick}
            title="Kick player"
            className="rounded px-1.5 py-0.5 text-xs text-[var(--muted)] opacity-0 transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] group-hover:opacity-100"
          >
            Kick
          </button>
        )}

        {/* Captain pick: pick this player */}
        {pickable && player.team === "none" && (
          <button
            onClick={onPick}
            className="rounded border border-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
          >
            Pick
          </button>
        )}

        {/* Leave team */}
        {extraAction && (
          <button
            onClick={extraAction.onClick}
            className="rounded px-1.5 py-0.5 text-xs text-[var(--muted)] opacity-0 transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] group-hover:opacity-100"
          >
            {extraAction.label}
          </button>
        )}
      </div>
    </div>
  );
}