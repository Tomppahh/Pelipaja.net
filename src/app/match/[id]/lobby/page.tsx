// Lobby modes for in-lobby settings
"use client";
const LOBBY_MODES = [
  { id: "use_current_teams", label: "Use Current Teams" },
  { id: "captain_pick",      label: "Captain Pick" },
  { id: "captain_map_veto",  label: "Captain Map Veto" },
  { id: "pick_map",          label: "Pick Map" },
] as const;
type LobbyMode = (typeof LOBBY_MODES)[number]["id"];


import { useEffect, useRef, useState, type FormEvent } from "react";
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
  isOwner?: boolean;
  isAdmin?: boolean;
  canCancel?: boolean;
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
  messages: LobbyMessage[];
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
  const lastLobbyEventRef = useRef(Date.now());
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Lobby settings state
  const [settingsMode, setSettingsMode] = useState<LobbyMode>("use_current_teams");
  const [settingsTeamSize, setSettingsTeamSize] = useState(5);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPulse, setChatPulse] = useState(true);

  useEffect(() => {
    if (!lobby) return;
    setSettingsMode(lobby.settings.mode as LobbyMode);
    setSettingsTeamSize(lobby.settings.teamSize);
  }, [lobby?.settings.mode, lobby?.settings.teamSize]);

  const lobbyMessages = lobby?.messages ?? [];

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [lobbyMessages.length]);

  useEffect(() => {
    if (chatOpen) {
      setChatPulse(false);
      return;
    }

    const timeout = window.setTimeout(() => setChatPulse(false), 7000);
    return () => window.clearTimeout(timeout);
  }, [chatOpen]);

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

    const markAlive = () => {
      lastLobbyEventRef.current = Date.now();
      setError(current => (current === "Lost connection to lobby. Refresh to reconnect." ? "" : current));
    };

    const staleTimer = window.setInterval(() => {
      if (Date.now() - lastLobbyEventRef.current > 10 * 60 * 1000) {
        setError("Lost connection to lobby. Refresh to reconnect.");
        es.close();
        window.clearInterval(staleTimer);
      }
    }, 30000);

    es.onmessage = (e) => {
      try {
        markAlive();
        const data = JSON.parse(e.data);
        if (data.heartbeat) return;
        if (data.closed) { setError("This lobby has been closed."); es.close(); return; }
        setLobby(data);
      } catch { /* malformed frame */ }
    };
    es.onerror = () => {
      // Allow EventSource to reconnect; the stale timer handles persistent loss.
    };
    return () => {
      window.clearInterval(staleTimer);
      es.close();
    };
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

  const leader = lobby?.players.find(p => p.steamId === lobby.leaderId);

  const canEditLobbySettings = lobby?.phase === "waiting" && (isLeader || isAdmin);
  const canCancelMatch = !!match && (lobby ? (isLeader || isAdmin) : !!match.canCancel);
  const cancelLabel = match?.status === "ready" || match?.status === "live"
    ? "Close Server"
    : "Cancel Match";
  const team1Captain = team1.find(p => p.isCaptain);
  const team2Captain = team2.find(p => p.isCaptain);
  const team1Label = `Team ${team1Captain?.displayName ?? "1"}`;
  const team2Label = `Team ${team2Captain?.displayName ?? "2"}`;

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
    try {
      const res = await fetch(`/api/matches/${id}/lobby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: name, ...extra }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (data && typeof data === "object" && "error" in data)
          ? String((data as { error?: unknown }).error)
          : "Something went wrong";
        setError(message);
        return false;
      }

      const maybeLobby = data as Partial<Lobby> | null;
      if (maybeLobby && typeof maybeLobby === "object" && Array.isArray(maybeLobby.players)) {
        setLobby(maybeLobby as Lobby);
      }

      return true;
    } catch {
      setError("Request failed. Check your connection and try again.");
      return false;
    }
  }

  async function saveLobbySettings() {
    setSettingsSaving(true);
    try {
      await action("update_settings", {
        settings: {
          mode: settingsMode,
          teamSize: settingsTeamSize,
        },
      });
    } finally {
      setSettingsSaving(false);
    }
  }

  async function cancelMatch() {
    if (!confirm("Cancel this match and close the server?")) return;

    const res = await fetch(`/api/matches/${id}/cancel`, { method: "POST" });
    if (res.ok) {
      router.push("/");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Failed to cancel match");
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

  async function transferLeader(targetSteamId: string) {
    await action("transfer_leader", { targetSteamId });
  }

  async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = chatDraft.trim();
    if (!text || chatSending) return;

    setChatSending(true);
    try {
      const ok = await action("chat", { text });
      if (ok) setChatDraft("");
    } finally {
      setChatSending(false);
    }
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

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      {canEditLobbySettings && (
        <section className="mb-8 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-8 shadow-2xl backdrop-blur">
          <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-[var(--foreground)]">Lobby Settings</h2>
          <p className="text-sm text-[var(--muted)]">Update the lobby before starting the ready check.</p>

          <div className="mt-6">
            <p className="mb-2 text-sm text-[var(--muted)]">Lobby mode</p>
            <div className="flex flex-wrap gap-2">
            {LOBBY_MODES.map((mode) => (
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

          <div className="mt-6">
            <span className="text-sm text-[var(--muted)]">Players per team</span>
            <input
              type="number"
              min={1}
              max={10}
              value={settingsTeamSize}
              onChange={e => setSettingsTeamSize(Number(e.target.value))}
              className="ml-2 w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={saveLobbySettings}
              disabled={settingsSaving}
              className="rounded-lg border border-[var(--accent-2)] bg-[var(--accent-2)] px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {settingsSaving ? "Saving..." : "Save Lobby Settings"}
            </button>
            <span className="text-sm text-[var(--muted)]">Changes apply immediately to the active lobby.</span>
          </div>
        </section>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle>{MODE_LABEL[lobby.settings.mode] ?? lobby.settings.mode}</PageTitle>
          <Muted className="mt-1">{PHASE_LABEL[lobby.phase]}</Muted>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Lobby leader: <span className="font-semibold text-[var(--foreground)]">{leader?.displayName ?? lobby.leaderId}</span>
          </p>
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
          {canCancelMatch && (
            <button
              onClick={cancelMatch}
              className="rounded-lg border border-[var(--danger)]/50 px-4 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
            >
              {cancelLabel}
            </button>
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
          label={team1Label}
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
          leaderId={lobby.leaderId}
          onTransferLeader={transferLeader}
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
                  leaderId={lobby.leaderId}
                  showLeaderAction={isLeader || isAdmin}
                  onTransferLeader={() => transferLeader(p.steamId)}
                />
              ))
          }
        </div>

        {/* Team 2 */}
        <TeamPanel
          label={team2Label}
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
          leaderId={lobby.leaderId}
          onTransferLeader={transferLeader}
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

      <div className="fixed right-4 top-[104px] z-50 flex max-h-[78vh] w-[min(92vw,360px)] flex-col items-end gap-3 sm:right-5 sm:top-[112px]">
        {chatOpen && (
          <section className="flex h-[min(68vh,520px)] w-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 shadow-2xl backdrop-blur">
            <div ref={chatScrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
              {lobbyMessages.map((message, index) => {
                const isMe = message.steamId === mySteamId;
                const time = new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <article
                    key={`${message.steamId}-${message.createdAt}-${index}`}
                    className={`rounded-xl border px-3 py-2 ${
                      isMe
                        ? "border-[var(--accent)]/35 bg-[var(--accent)]/10"
                        : "border-[var(--border)] bg-[var(--background)]/55"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-semibold text-[var(--foreground)]">
                        {message.displayName}
                      </p>
                      <span className="shrink-0 text-[11px] text-[var(--muted)]">{time}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--foreground)]/90">{message.text}</p>
                  </article>
                );
              })}
            </div>

            <form onSubmit={sendChatMessage} className="flex items-end gap-2 border-t border-[var(--border)] p-3">
              <textarea
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Message"
                className="min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                type="submit"
                disabled={chatSending || !chatDraft.trim()}
                className="h-10 shrink-0 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-contrast)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {chatSending ? "..." : "Send"}
              </button>
            </form>
          </section>
        )}

        <button
          onClick={() => setChatOpen((open) => !open)}
          className={`inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-contrast)] shadow-lg transition hover:brightness-110 ${chatPulse ? "animate-pulse" : ""}`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3v-5.5A8.5 8.5 0 1 1 21 11.5Z" />
          </svg>
          {chatOpen ? "Hide Chat" : "Chat"}
        </button>
      </div>
    </main>
  );
}

// ── TeamPanel ─────────────────────────────────────────────────────────────────

function TeamPanel({
  label, team, players, teamSize, mySteamId, isLeader, isAdmin,
  phase, myTeam, isMyCaptainTurn,
  onJoin, onLeaveTeam, onSetCaptain, onKick, onCaptainPick,
  leaderId, onTransferLeader,
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
  const canJoin = phase === "waiting" && myTeam !== team && players.length < teamSize;
  const amOnThisTeam = myTeam === team;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</p>
        <span className="text-xs text-[var(--muted)]">{players.length}/{teamSize}</span>
      </div>

      {isLeader || isAdmin ? (
        <p className="text-[11px] text-[var(--muted)]">Use the captain button on a player to reassign that team’s captain.</p>
      ) : null}

      {players.map(p => (
        <PlayerRow
          key={p.steamId}
          player={p}
          isMe={p.steamId === mySteamId}
          isLeader={isLeader}
          showCaptainToggle={phase === "waiting" && (isLeader || isAdmin)}
          pickable={false}
          onPick={() => {}}
          onSetCaptain={() => onSetCaptain(p.steamId)}
          showKickToggle={isLeader || isAdmin}
          onKick={() => onKick(p.steamId)}
          leaderId={leaderId}
          showLeaderAction={(isLeader || isAdmin) && p.steamId !== leaderId}
          onTransferLeader={() => onTransferLeader(p.steamId)}
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
  leaderId, showLeaderAction, onTransferLeader,
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
  leaderId: string;
  showLeaderAction?: boolean;
  onTransferLeader?: () => void;
}) {
  return (
    <div className={`group flex min-h-[96px] flex-col justify-between rounded-lg border px-3 py-2.5 text-sm transition ${
      isMe
        ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
        : "border-[var(--border)] bg-[var(--surface)]"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {player.avatarUrl
            ? <img src={player.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" />
            : <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--surface-hover)]" />
          }
          <p className="min-w-0 truncate font-medium text-[var(--foreground)]">{player.displayName}</p>
        </div>

        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${player.isReady ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-[var(--border)] text-[var(--muted)]"}`}>
          {player.isReady ? "Ready" : "Not ready"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="flex min-h-5 flex-wrap items-center gap-1.5">
          {player.isCaptain && (
            <span className="rounded-full border border-[var(--accent)]/40 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
              Captain
            </span>
          )}
          {player.steamId === leaderId && (
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--foreground)]/70">
              Leader
            </span>
          )}
        </div>

        <div className="flex min-h-5 flex-wrap items-center justify-end gap-1.5">

          {/* Leader: assign captain */}
          {showCaptainToggle && !player.isCaptain && (
            <button
              onClick={onSetCaptain}
              title="Make captain"
              className="rounded-full border border-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
            >
              Make captain
            </button>
          )}

          {/* Kick player (leader/admin) */}
          {showKickToggle && !isMe && onKick && (
            <button
              onClick={onKick}
              title="Kick player"
              className="rounded px-1.5 py-0.5 text-[11px] text-[var(--muted)] transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
            >
              Kick
            </button>
          )}

          {showLeaderAction && onTransferLeader && player.steamId !== leaderId && (
            <button
              onClick={onTransferLeader}
              title="Give lobby leader"
              className="rounded px-1.5 py-0.5 text-[11px] text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              Give leader
            </button>
          )}

          {/* Captain pick: pick this player */}
          {pickable && player.team === "none" && (
            <button
              onClick={onPick}
              className="rounded border border-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
            >
              Pick
            </button>
          )}

          {/* Leave team */}
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