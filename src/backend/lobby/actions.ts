import { NextResponse } from "next/server";
import Lobby, { ILobby, LobbyPlayer } from "@/src/models/lobby";
import { broadcastLobbyUpdate } from "@/src/backend/services/sse";
import {
  handleAllReady,
  advanceBotCaptainPicks,
  startMapVeto,
  finalizeLobbyAndStartServer,
  scheduleBotVeto,
} from "./phases";
import { ActionContext, SessionUser } from "./types";

type ActionHandler = (ctx: ActionContext) => Promise<NextResponse>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isPrivileged(lobby: ILobby, user: SessionUser) {
  return lobby.leaderId === user.steamId || user.role === "admin";
}

// ─── Player actions ───────────────────────────────────────────────────────────

async function join({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  const alreadyIn = lobby.players.some(p => p.steamId === user.steamId);
  if (!alreadyIn) {
    const newPlayer: LobbyPlayer = {
      steamId: user.steamId,
      displayName: user.displayName ?? user.steamId,
      avatarUrl: user.avatarUrl,
      team: "none",
      isCaptain: false,
      isReady: false,
    };

    // Assign default captains: first available team without a captain
    const hasTeam1Captain = lobby.players.some(p => p.isCaptain && p.team === "team1");
    const hasTeam2Captain = lobby.players.some(p => p.isCaptain && p.team === "team2");
    if (!hasTeam1Captain) {
      newPlayer.team = "team1";
      newPlayer.isCaptain = true;
    } else if (!hasTeam2Captain) {
      newPlayer.team = "team2";
      newPlayer.isCaptain = true;
    }

    lobby.players.push(newPlayer);
    await lobby.save();
    broadcastLobbyUpdate(matchId, lobby.toObject());
  }
  return NextResponse.json(lobby);
}

async function joinTeam({ lobby, user, body, matchId }: ActionContext): Promise<NextResponse> {
  const team = body.team as string;
  const player = lobby.players.find(p => p.steamId === user.steamId);
  if (!player) return error("Not in lobby", 403);

  const teamSize = lobby.players.filter(p => p.team === team).length;
  if (teamSize >= lobby.settings.teamSize) return error("Team is full", 400);

  player.team = team as LobbyPlayer["team"];
  await lobby.save();
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

async function leaveTeam({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  const player = lobby.players.find(p => p.steamId === user.steamId);
  if (!player) return error("Not in lobby", 403);

  const origTeam = player.team;
  player.team = "none";
  player.isCaptain = false;

  // Ensure the original team still has a captain
  if (origTeam === "team1" || origTeam === "team2") {
    const hasCaptain = lobby.players.some(p => p.isCaptain && p.team === origTeam);
    if (!hasCaptain) {
      const candidate = lobby.players.find(p => p.team === origTeam);
      if (candidate) candidate.isCaptain = true;
    }
  }

  await lobby.save();
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

async function leaveLobby({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  const wasLeader = lobby.leaderId === user.steamId;
  lobby.players = lobby.players.filter(p => p.steamId !== user.steamId);

  // Ensure both teams have captains
  ["team1", "team2"].forEach((team) => {
    const hasCaptain = lobby.players.some(p => p.isCaptain && p.team === team);
    if (!hasCaptain) {
      const candidate = lobby.players.find(p => p.team === team);
      if (candidate) candidate.isCaptain = true;
    }
  });

  await lobby.save();
  broadcastLobbyUpdate(matchId, lobby.toObject());

  // If the leaving player was the leader and no players remain, close the lobby
  if (wasLeader && lobby.players.length === 0) {
    await Lobby.deleteOne({ matchId });
    broadcastLobbyUpdate(matchId, { closed: true });
    return NextResponse.json({ success: true, closed: true });
  }

  return NextResponse.json({ success: true });
}

async function kickPlayer({ lobby, user, body, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);

  const targetSteamId = body.targetSteamId as string;
  if (!targetSteamId) return error("Missing targetSteamId", 400);
  if (targetSteamId === lobby.leaderId) return error("Cannot kick the lobby leader", 400);

  const idx = lobby.players.findIndex(p => p.steamId === targetSteamId);
  if (idx === -1) return error("Player not found", 404);

  const removed = lobby.players.splice(idx, 1)[0];

  // Ensure each team still has a captain: if a captain was removed, try to assign a new one
  ["team1", "team2"].forEach((team) => {
    const hasCaptain = lobby.players.some(p => p.isCaptain && p.team === team);
    if (!hasCaptain) {
      const candidate = lobby.players.find(p => p.team === team);
      if (candidate) candidate.isCaptain = true;
    }
  });

  await lobby.save();
  broadcastLobbyUpdate(matchId, { ...lobby.toObject(), kicked: removed.steamId });
  return NextResponse.json({ success: true, kicked: removed.steamId });
}

async function leaveLobbyAndClose({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  if (lobby.leaderId !== user.steamId) return error("Only the owner can close the lobby", 403);

  await Lobby.deleteOne({ matchId });
  broadcastLobbyUpdate(matchId, { closed: true });
  return NextResponse.json({ success: true, closed: true });
}

async function leaveLobbyAndPromote({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  if (lobby.leaderId !== user.steamId) return error("Only the owner can promote", 403);

  const candidates = lobby.players.filter(
    p => !p.steamId.startsWith("bot-") && p.steamId !== user.steamId
  );

  if (candidates.length === 0) {
    await Lobby.deleteOne({ matchId });
    broadcastLobbyUpdate(matchId, { closed: true });
    return NextResponse.json({ success: true, closed: true });
  }

  const newLeader = candidates[Math.floor(Math.random() * candidates.length)];
  lobby.leaderId = newLeader.steamId;
  lobby.players = lobby.players.filter(p => p.steamId !== user.steamId);

  // Ensure both teams have captains after promoting
  ["team1", "team2"].forEach((team) => {
    const hasCaptain = lobby.players.some(p => p.isCaptain && p.team === team);
    if (!hasCaptain) {
      const candidate = lobby.players.find(p => p.team === team);
      if (candidate) candidate.isCaptain = true;
    }
  });

  await lobby.save();
  broadcastLobbyUpdate(matchId, { ...lobby.toObject(), newLeaderId: newLeader.steamId });
  return NextResponse.json({ success: true, newLeader: newLeader.displayName });
}

async function ready({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  const player = lobby.players.find(p => p.steamId === user.steamId);
  if (!player) return error("Not in lobby", 403);

  player.isReady = true;
  await lobby.save();

  const allReady = lobby.players
    .filter(p => p.team !== "none")
    .every(p => p.isReady);

  if (allReady) {
    await handleAllReady(lobby, matchId);
  } else {
    broadcastLobbyUpdate(matchId, lobby.toObject());
  }

  return NextResponse.json(lobby);
}

// ─── Leader / admin actions ───────────────────────────────────────────────────

async function shuffle({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);

  const shuffled = [...lobby.players].sort(() => Math.random() - 0.5);
  const half = Math.floor(shuffled.length / 2);
  lobby.players = shuffled.map((p, i) => ({
    ...p,
    team: i < half ? "team1" : "team2",
    isCaptain: i === 0 || i === half,
  }));

  await lobby.save();
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

async function fillBots({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);

  // Move the requesting player off "none" if they haven't picked a team yet
  const requester = lobby.players.find(p => p.steamId === user.steamId);
  if (requester?.team === "none") {
    const team1Count = lobby.players.filter(p => p.team === "team1").length;
    requester.team = team1Count < lobby.settings.teamSize ? "team1" : "team2";
  }

  const team1Count = lobby.players.filter(p => p.team === "team1").length;
  const team2Count = lobby.players.filter(p => p.team === "team2").length;
  const needed1 = Math.max(0, lobby.settings.teamSize - team1Count);
  const needed2 = Math.max(0, lobby.settings.teamSize - team2Count);
  const now = Date.now();

  const bots: LobbyPlayer[] = [
    ...Array.from({ length: needed1 }, (_, i) => ({
      steamId: `bot-team1-${now}-${i}`,
      displayName: `Bot ${team1Count + i + 1}`,
      team: "team1" as const,
      isCaptain: false,
      isReady: false,
    })),
    ...Array.from({ length: needed2 }, (_, i) => ({
      steamId: `bot-team2-${now}-${i}`,
      displayName: `Bot ${team2Count + i + 1}`,
      team: "team2" as const,
      isCaptain: false,
      isReady: false,
    })),
  ];

  lobby.players.push(...bots);
  await lobby.save();
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

async function clearBots({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);

  lobby.players = lobby.players.filter(p => !p.steamId.startsWith("bot-"));
  lobby.phase = "waiting";
  lobby.coinFlipWinner = undefined;
  lobby.mapVetoState = undefined;
  lobby.captainPickState = undefined;
  lobby.players.forEach(p => {
    p.isReady = false;
    p.isCaptain = false;
    if (p.team !== "team1" && p.team !== "team2") p.team = "none";
  });

  await lobby.save();
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

async function setCaptain({ lobby, user, body, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);

  const target = lobby.players.find(p => p.steamId === body.targetSteamId);
  if (!target) return error("Player not found", 404);

  // Clear the existing captain on that team first
  lobby.players.forEach(p => { if (p.team === target.team) p.isCaptain = false; });
  target.isCaptain = true;

  await lobby.save();
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

async function updateSettings({ lobby, user, body, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);

  lobby.settings = { ...lobby.settings, ...(body.settings as object) };
  await lobby.save();
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

async function startReadyCheck({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);

  const team1 = lobby.players.filter(p => p.team === "team1");
  const team2 = lobby.players.filter(p => p.team === "team2");
  if (team1.length !== lobby.settings.teamSize || team2.length !== lobby.settings.teamSize) {
    return error("Teams are not full", 400);
  }

  lobby.phase = "ready_check";
  lobby.players.forEach(p => (p.isReady = false));
  await lobby.save();

  const deadline = Date.now() + 5000;
  broadcastLobbyUpdate(matchId, { ...lobby.toObject(), readyCheckDeadline: deadline });

  // Bots always ready up instantly
  setTimeout(async () => {
    const fresh = await Lobby.findOne({ matchId });
    if (!fresh || fresh.phase !== "ready_check") return;
    fresh.players.forEach((p: LobbyPlayer) => { if (p.steamId.startsWith("bot-")) p.isReady = true; });
    await fresh.save();
    broadcastLobbyUpdate(matchId, fresh.toObject());
  }, 500);

  // Fail the ready check if not everyone confirmed in time
  setTimeout(async () => {
    const fresh = await Lobby.findOne({ matchId });
    if (!fresh || fresh.phase !== "ready_check") return;
    const allReady = fresh.players.every((p: LobbyPlayer) => p.team === "none" || p.isReady);
    if (allReady) return;

    fresh.phase = "waiting";
    fresh.players.forEach((p: LobbyPlayer) => (p.isReady = false));
    await fresh.save();
    broadcastLobbyUpdate(matchId, { ...fresh.toObject(), readyCheckFailed: true });
  }, 5500);

  return NextResponse.json({ ...lobby.toObject(), readyCheckDeadline: deadline });
}

// ─── Captain pick / map veto ──────────────────────────────────────────────────

async function captainPick({ lobby, user, body, matchId }: ActionContext): Promise<NextResponse> {
  if (!lobby.captainPickState) return error("Not in pick phase", 400);

  const { currentTurn, unpickedPlayers } = lobby.captainPickState;
  const captain = lobby.players.find(p => p.steamId === user.steamId && p.isCaptain);
  
  if (!captain || captain.team !== currentTurn) return error("Not your turn", 403);

  const picked = lobby.players.find(p => p.steamId === body.pickedSteamId);
  if (!picked) return error("Player not found", 404);

  // Check if both teams are full
  const team1Count = lobby.players.filter(p => p.team === "team1").length;
  const team2Count = lobby.players.filter(p => p.team === "team2").length;

  // Here, we assume `lobby.settings.teamSize` gives the maximum number of players per team.
  const isTeamSizeFull = team1Count >= lobby.settings.teamSize && team2Count >= lobby.settings.teamSize;

  if (isTeamSizeFull) {
    return NextResponse.json({ success: true, message: "Both teams are fully populated. No further picks are allowed." });
  }

  // Proceed with the usual picking logic
  picked.team = currentTurn;
  lobby.captainPickState.unpickedPlayers = unpickedPlayers.filter(id => id !== picked.steamId);
  lobby.captainPickState.currentTurn = currentTurn === "team1" ? "team2" : "team1";

  if (lobby.captainPickState.unpickedPlayers.length === 0) {
    await startMapVeto(lobby, matchId);
  } else {
    await lobby.save();
    broadcastLobbyUpdate(matchId, lobby.toObject());
    await advanceBotCaptainPicks(matchId);
  }

  return NextResponse.json(lobby);
}

async function captainPickComplete({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);
  if (lobby.phase !== "captain_pick") return error("Not in pick phase", 400);

  const unassigned = lobby.players.filter(p => p.team === "none");
  const team1Count = lobby.players.filter(p => p.team === "team1").length;
  const team2Count = lobby.players.filter(p => p.team === "team2").length;
  const teamsFull = team1Count >= lobby.settings.teamSize && team2Count >= lobby.settings.teamSize;

  if (unassigned.length === 0 || teamsFull) {
    await startMapVeto(lobby, matchId);
    return NextResponse.json(lobby);
  }

  return error("Cannot complete pick yet", 400);
}

async function mapVeto({ lobby, user, body, matchId }: ActionContext): Promise<NextResponse> {
  if (!lobby.mapVetoState) return error("Not in veto phase", 400);

  const { currentTurn, remainingMaps } = lobby.mapVetoState;
  const captain = lobby.players.find(p => p.steamId === user.steamId && p.isCaptain);
  if (!captain || captain.team !== currentTurn) return error("Not your turn", 403);

  const { map, vetoAction } = body as { map: string; vetoAction: "ban" | "pick" };
  lobby.mapVetoState.vetoHistory.push({ team: currentTurn, map, action: vetoAction });
  lobby.mapVetoState.remainingMaps = remainingMaps.filter(m => m !== map);
  lobby.mapVetoState.currentTurn = currentTurn === "team1" ? "team2" : "team1";

  if (lobby.mapVetoState.remainingMaps.length === 1) {
    await finalizeLobbyAndStartServer(lobby, matchId);
  } else {
    await lobby.save();
    broadcastLobbyUpdate(matchId, lobby.toObject());
    scheduleBotVeto(matchId);
  }

  return NextResponse.json(lobby);
}

// ─── Action map ───────────────────────────────────────────────────────────────

export const lobbyActions: Record<string, ActionHandler> = {
  join,
  join_team: joinTeam,
  leave_team: leaveTeam,
  leave_lobby: leaveLobby,
  leave_lobby_and_close: leaveLobbyAndClose,
  leave_lobby_and_promote: leaveLobbyAndPromote,
  ready,
  shuffle,
  fill_bots: fillBots,
  clear_bots: clearBots,
  set_captain: setCaptain,
  update_settings: updateSettings,
  start_ready_check: startReadyCheck,
  captain_pick: captainPick,
  captain_pick_complete: captainPickComplete,
  kick_player: kickPlayer,
  map_veto: mapVeto,
};