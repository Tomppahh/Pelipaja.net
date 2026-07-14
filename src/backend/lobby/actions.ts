import { NextResponse } from "next/server";
import Lobby, { ILobby, LobbyPlayer } from "@/src/models/lobby";
import { broadcastLobbyUpdate } from "@/src/backend/services/sse";
import {
  handleAllReady,
  advanceBotCaptainPicks,
  proceedAfterCaptainPick,
  finalizeLobbyAndStartServer,
  scheduleBotVeto,
  validateLobbyCanStart,
} from "./phases";
import { ActionContext, SessionUser } from "./types";
import bcrypt from "bcrypt";

type ActionHandler = (ctx: ActionContext) => Promise<NextResponse>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function safeSave(doc: ILobby): Promise<NextResponse | null> {
  try {
    await doc.save();
    return null;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "VersionError") {
      return error("Conflict: document was modified by another request. Please retry.", 409);
    }
    throw err;
  }
}

function isPrivileged(lobby: ILobby, user: SessionUser) {
  return lobby.leaderId === user.steamId || user.role === "admin";
}

// ─── Player actions ───────────────────────────────────────────────────────────

async function join({ lobby, user, body, matchId }: ActionContext): Promise<NextResponse> {
  const alreadyIn = lobby.players.some(p => p.steamId === user.steamId);
  if (!alreadyIn) {
    // Prevent joining if already in another active lobby
    const otherLobby = await Lobby.findOne({
      _id: { $ne: lobby._id },
      "players.steamId": user.steamId,
    }).select("matchId");
    if (otherLobby) {
      return error("You are already in another lobby. Leave it first.", 409);
    }

    // Check password if lobby is password-protected
    if (lobby.settings.password) {
      const provided = typeof body?.password === "string" ? body.password : "";
      if (!provided) return error("This lobby requires a password", 403);
      const valid = await bcrypt.compare(provided, lobby.settings.password);
      if (!valid) return error("Invalid password", 403);
    }
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
    const saveErr = await safeSave(lobby);
    if (saveErr) return saveErr;
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

  const previousTeam = player.team;
  const wasCaptain = player.isCaptain;

  player.team = team as LobbyPlayer["team"];
  player.isCaptain = false;

  if (previousTeam === "team1" || previousTeam === "team2") {
    const previousTeamHasCaptain = lobby.players.some(p => p.isCaptain && p.team === previousTeam);
    if (!previousTeamHasCaptain) {
      const replacement = lobby.players.find(p => p.team === previousTeam && p.steamId !== player.steamId);
      if (replacement) replacement.isCaptain = true;
    }
  }

  const targetTeamHasCaptain = lobby.players.some(p => p.isCaptain && p.team === team);
  if (!targetTeamHasCaptain && (wasCaptain || !lobby.players.some(p => p.team === team && p.isCaptain))) {
    player.isCaptain = true;
  }

  const saveErr = await safeSave(lobby);
  if (saveErr) return saveErr;
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

async function leaveTeam({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  const player = lobby.players.find(p => p.steamId === user.steamId);
  if (!player) return error("Not in lobby", 403);

  const origTeam = player.team;
  player.team = "none";
  player.isCaptain = false;
  player.isReady = false;

  // Ensure the original team still has a captain
  if (origTeam === "team1" || origTeam === "team2") {
    const hasCaptain = lobby.players.some(p => p.isCaptain && p.team === origTeam);
    if (!hasCaptain) {
      const candidate = lobby.players.find(p => p.team === origTeam);
      if (candidate) candidate.isCaptain = true;
    }
  }

  const saveErr = await safeSave(lobby);
  if (saveErr) return saveErr;
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

async function leaveLobby({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  const wasLeader = lobby.leaderId === user.steamId;
  const remainingAfterLeave = lobby.players.filter(p => p.steamId !== user.steamId);

  // Check BEFORE any mutation: if the leaving player is the leader and players remain, block leaving
  if (wasLeader && remainingAfterLeave.length > 0) {
    return error("You are the lobby leader. Transfer ownership before leaving.", 400);
  }

  lobby.players = remainingAfterLeave;

  // Ensure both teams have captains
  ["team1", "team2"].forEach((team) => {
    const hasCaptain = lobby.players.some(p => p.isCaptain && p.team === team);
    if (!hasCaptain) {
      const candidate = lobby.players.find(p => p.team === team);
      if (candidate) candidate.isCaptain = true;
    }
  });

  const saveErr2 = await safeSave(lobby);
  if (saveErr2) return saveErr2;
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

  const saveErr3 = await safeSave(lobby);
  if (saveErr3) return saveErr3;
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

  const saveErr4 = await safeSave(lobby);
  if (saveErr4) return saveErr4;
  broadcastLobbyUpdate(matchId, { ...lobby.toObject(), newLeaderId: newLeader.steamId });
  return NextResponse.json({ success: true, newLeader: newLeader.displayName });
}

async function ready({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  const player = lobby.players.find(p => p.steamId === user.steamId);
  if (!player) return error("Not in lobby", 403);
  if (player.team === "none") return error("Join a team first", 400);

  player.isReady = true;
  const saveErr5 = await safeSave(lobby);
  if (saveErr5) return saveErr5;

  const allReady = lobby.players
    .filter(p => p.team !== "none")
    .every(p => p.isReady);

  if (allReady) {
    const blocker = await handleAllReady(lobby, matchId);
    if (blocker) return error(blocker, 400);
  } else {
    broadcastLobbyUpdate(matchId, lobby.toObject());
  }

  return NextResponse.json(lobby);
}

async function unready({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  const player = lobby.players.find(p => p.steamId === user.steamId);
  if (!player) return error("Not in lobby", 403);
  if (lobby.phase !== "ready_check") return error("Not in ready check", 400);

  player.isReady = false;
  const saveErr = await safeSave(lobby);
  if (saveErr) return saveErr;
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

// ─── Leader / admin actions ───────────────────────────────────────────────────

async function shuffle({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);

  if (lobby.settings.teamSize <= 1) return error("Nothing to shuffle with team size 1", 400);

  // Identify the two captains — they stay on their sides
  const captain1 = lobby.players.find(p => p.isCaptain && p.team === "team1");
  const captain2 = lobby.players.find(p => p.isCaptain && p.team === "team2");

  // Everyone who isn't a captain gets shuffled
  const others = lobby.players.filter(
    p => p.steamId !== captain1?.steamId && p.steamId !== captain2?.steamId
  );
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }

  const half = Math.floor(others.length / 2);
  const shuffled = others.map((p, i) => ({
    ...p,
    team: (i < half ? "team1" : "team2") as "team1" | "team2",
    isCaptain: false,
  }));

  // Rebuild player list: captains first (in their original positions), then shuffled players
  lobby.players = [
    ...(captain1 ? [{ ...captain1, team: "team1" as const, isCaptain: true }] : []),
    ...(captain2 ? [{ ...captain2, team: "team2" as const, isCaptain: true }] : []),
    ...shuffled,
  ];

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
  const saveErr7 = await safeSave(lobby);
  if (saveErr7) return saveErr7;
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

  const saveErr8 = await safeSave(lobby);
  if (saveErr8) return saveErr8;
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

  const saveErr9 = await safeSave(lobby);
  if (saveErr9) return saveErr9;
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

async function transferLeader({ lobby, user, body, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);

  const targetSteamId = body.targetSteamId as string;
  if (!targetSteamId) return error("Missing targetSteamId", 400);

  const target = lobby.players.find(p => p.steamId === targetSteamId);
  if (!target) return error("Player not found", 404);

  lobby.leaderId = targetSteamId;
  const saveErr10 = await safeSave(lobby);
  if (saveErr10) return saveErr10;
  broadcastLobbyUpdate(matchId, { ...lobby.toObject(), newLeaderId: targetSteamId });
  return NextResponse.json({ success: true, newLeader: target.displayName });
}

async function updateSettings({ lobby, user, body, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);
  if (lobby.phase !== "waiting") return error("Cannot change settings after ready check", 400);

  const incoming = body.settings as Record<string, unknown>;
  if (!incoming || typeof incoming !== "object") return error("Invalid settings", 400);

  const allowed: Record<string, unknown> = {};
  if (typeof incoming.mode === "string") allowed.mode = incoming.mode;
  if (typeof incoming.teamSize === "number") allowed.teamSize = incoming.teamSize;

  // Lobby metadata
  if (typeof incoming.name === "string") allowed.name = incoming.name.slice(0, 60);
  if (typeof incoming.isPublic === "boolean") allowed.isPublic = incoming.isPublic;
  if (typeof incoming.password === "string") {
    allowed.password = incoming.password ? await bcrypt.hash(incoming.password, 10) : "";
  }

  // Map pool (array of map names)
  if (Array.isArray(incoming.mapPool)) {
    allowed.mapPool = incoming.mapPool.filter((m: unknown) => typeof m === "string");
  }

  // Map chooser (only used for fixed-map modes like use_current_teams).
  // Drive clearing from the `useWorkshop` flag so we don't depend on the
  // client sending `undefined` (which JSON.stringify drops).
  const useWorkshop = incoming.useWorkshop === true;
  allowed.useWorkshop = useWorkshop;
  if (useWorkshop) {
    if (typeof incoming.workshopMapId === "string" && incoming.workshopMapId) allowed.workshopMapId = incoming.workshopMapId;
    if (typeof incoming.workshopMapName === "string" && incoming.workshopMapName) allowed.workshopMapName = incoming.workshopMapName;
    allowed.map = undefined; // clear fixed official map
  } else {
    if (typeof incoming.map === "string" && incoming.map) allowed.map = incoming.map;
    allowed.workshopMapId = undefined;   // clear workshop selection
    allowed.workshopMapName = undefined;
  }

  lobby.settings = { ...lobby.settings, ...allowed };
  const saveErr11 = await safeSave(lobby);
  if (saveErr11) return saveErr11;
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby);
}

async function startReadyCheck({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);

  const blocker = validateLobbyCanStart(lobby);
  if (blocker) return error(blocker, 400);

  const team1 = lobby.players.filter(p => p.team === "team1");
  const team2 = lobby.players.filter(p => p.team === "team2");
  if (team1.length !== lobby.settings.teamSize || team2.length !== lobby.settings.teamSize) {
    return error("Teams are not full", 400);
  }

  lobby.phase = "ready_check";
  lobby.players.forEach(p => (p.isReady = false));
  const saveErr12 = await safeSave(lobby);
  if (saveErr12) return saveErr12;

  const deadline = Date.now() + 5000;
  broadcastLobbyUpdate(matchId, { ...lobby.toObject(), readyCheckDeadline: deadline });

  // NOTE: The bot-ready save() could theoretically overwrite a concurrent human
  // ready-state change, but the window is small (~500ms) and acceptable.
  // Bots always ready up instantly
  setTimeout(async () => {
    const fresh = await Lobby.findOne({ matchId });
    if (!fresh || fresh.phase !== "ready_check") return;
    fresh.players.forEach((p: LobbyPlayer) => { if (p.steamId.startsWith("bot-")) p.isReady = true; });
    const botSaveErr = await safeSave(fresh);
    if (botSaveErr) return;
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
    const timeoutSaveErr = await safeSave(fresh);
    if (timeoutSaveErr) return;
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
    await proceedAfterCaptainPick(lobby, matchId);
  } else {
    const saveErr13 = await safeSave(lobby);
    if (saveErr13) return saveErr13;
    broadcastLobbyUpdate(matchId, lobby.toObject());
    await advanceBotCaptainPicks(matchId);
  }

  return NextResponse.json(lobby);
}

async function captainPickComplete({ lobby, user, matchId }: ActionContext): Promise<NextResponse> {
  if (!isPrivileged(lobby, user)) return error("Forbidden", 403);
  if (lobby.phase !== "captain_pick") return error("Not in pick phase", 400);

  const blocker = validateLobbyCanStart(lobby);
  if (blocker) return error(blocker, 400);

  const unassigned = lobby.players.filter(p => p.team === "none");
  const team1Count = lobby.players.filter(p => p.team === "team1").length;
  const team2Count = lobby.players.filter(p => p.team === "team2").length;
  const teamsFull = team1Count >= lobby.settings.teamSize && team2Count >= lobby.settings.teamSize;

  if (unassigned.length === 0 || teamsFull) {
    await proceedAfterCaptainPick(lobby, matchId);
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
  if (!remainingMaps.includes(map)) return error("Map not in pool", 400);

  lobby.mapVetoState.vetoHistory.push({ team: currentTurn, map, action: vetoAction });
  lobby.mapVetoState.remainingMaps = remainingMaps.filter(m => m !== map);
  lobby.mapVetoState.currentTurn = currentTurn === "team1" ? "team2" : "team1";

  if (lobby.mapVetoState.remainingMaps.length === 1) {
    await finalizeLobbyAndStartServer(lobby, matchId);
  } else {
    const saveErr14 = await safeSave(lobby);
    if (saveErr14) return saveErr14;
    broadcastLobbyUpdate(matchId, lobby.toObject());
    scheduleBotVeto(matchId);
  }

  return NextResponse.json(lobby);
}

async function chat({ lobby, user, body, matchId }: ActionContext): Promise<NextResponse> {
  const player = lobby.players.find(p => p.steamId === user.steamId);
  if (!player) return error("Not in lobby", 403);

  const text = typeof body.text === "string" ? body.text : typeof body.message === "string" ? body.message : "";
  const trimmed = text.trim();
  if (!trimmed) return error("Empty message", 400);

  if (!Array.isArray(lobby.messages)) lobby.messages = [];

  lobby.messages.push({
    steamId: player.steamId,
    displayName: player.displayName,
    text: trimmed.slice(0, 200),
    createdAt: new Date(),
  });

  const saveErr15 = await safeSave(lobby);
  if (saveErr15) return saveErr15;
  broadcastLobbyUpdate(matchId, lobby.toObject());
  return NextResponse.json(lobby.toObject());
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
  unready,
  shuffle,
  fill_bots: fillBots,
  clear_bots: clearBots,
  set_captain: setCaptain,
  transfer_leader: transferLeader,
  update_settings: updateSettings,
  start_ready_check: startReadyCheck,
  captain_pick: captainPick,
  captain_pick_complete: captainPickComplete,
  kick_player: kickPlayer,
  map_veto: mapVeto,
  chat,
};