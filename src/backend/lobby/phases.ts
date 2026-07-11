import Lobby, { ILobby, LobbyPlayer } from "@/src/models/lobby";
import Match from "@/src/models/Match";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";
import { broadcastLobbyUpdate } from "@/src/backend/services/sse";
import { CreateServerResult } from "./types";

export function validateLobbyCanStart(lobby: ILobby): string | null {
  const team1 = lobby.players.filter(p => p.team === "team1");
  const team2 = lobby.players.filter(p => p.team === "team2");
  const unassigned = lobby.players.filter(p => p.team === "none");

  if (unassigned.length > 0) {
    return "Assign all players to a team before starting.";
  }

  if (team1.length === 0 || team2.length === 0) {
    return "Both teams must have players before starting.";
  }

  const team1Captains = team1.filter(p => p.isCaptain);
  const team2Captains = team2.filter(p => p.isCaptain);

  if (team1Captains.length !== 1 || team2Captains.length !== 1) {
    return "Each team must have exactly one captain before starting.";
  }

  return null;
}

// ─── Entry point after all players ready up ──────────────────────────────────

export async function handleAllReady(lobby: ILobby, matchId: string): Promise<string | null> {
  const blocker = validateLobbyCanStart(lobby);
  if (blocker) return blocker;

  const { mode } = lobby.settings;

  if (mode === "use_current_teams") {
    await finalizeLobbyAndStartServer(lobby, matchId);
    return null;
  }

  if (mode === "pick_map") {
    await startMapVeto(lobby, matchId);
    return null;
  }

  if (mode === "captain_pick" || mode === "captain_map_veto") {
    await startCaptainPick(lobby, matchId);
    return null;
  }

  return "Unsupported lobby mode.";
}

// ─── Captain pick ─────────────────────────────────────────────────────────────

async function startCaptainPick(lobby: ILobby, matchId: string) {
  const coinFlipWinner: "team1" | "team2" = Math.random() < 0.5 ? "team1" : "team2";

  // Use pre-assigned captains if set, otherwise fall back to first player on each team
  const team1Captain =
    lobby.players.find(p => p.team === "team1" && p.isCaptain) ??
    lobby.players.find(p => p.team === "team1");
  const team2Captain =
    lobby.players.find(p => p.team === "team2" && p.isCaptain) ??
    lobby.players.find(p => p.team === "team2");

  // Put all non-captains back into the unpicked pool
  lobby.players.forEach(p => {
    const isCaptain = p.steamId === team1Captain?.steamId || p.steamId === team2Captain?.steamId;
    p.isCaptain = isCaptain;
    p.isReady = false;
    if (!isCaptain) p.team = "none";
  });

  if (team1Captain) { team1Captain.team = "team1"; team1Captain.isCaptain = true; }
  if (team2Captain) { team2Captain.team = "team2"; team2Captain.isCaptain = true; }

  const unpickedPlayers = lobby.players.filter(p => !p.isCaptain).map(p => p.steamId);

  lobby.coinFlipWinner = coinFlipWinner;
  lobby.phase = "captain_pick";
  lobby.captainPickState = { currentTurn: coinFlipWinner, unpickedPlayers };

  await lobby.save();
  broadcastLobbyUpdate(matchId, { ...lobby.toObject(), coinFlip: coinFlipWinner });

  await advanceBotCaptainPicks(matchId);
}

// Loops through bot captain turns automatically until a human captain needs to pick
export async function advanceBotCaptainPicks(matchId: string) {
  while (true) {
    const lobby = await Lobby.findOne({ matchId });
    if (!lobby || lobby.phase !== "captain_pick" || !lobby.captainPickState) return;

    const { currentTurn, unpickedPlayers } = lobby.captainPickState;
    const currentCaptain = lobby.players.find(
      (p: LobbyPlayer) => p.isCaptain && p.team === currentTurn
    );

    if (!currentCaptain?.steamId.startsWith("bot-")) return; // Human's turn — stop

    const target = lobby.players.find((p: LobbyPlayer) => unpickedPlayers.includes(p.steamId));
    if (!target) return;

    target.team = currentTurn;
    lobby.captainPickState.unpickedPlayers = unpickedPlayers.filter(id => id !== target.steamId);
    lobby.captainPickState.currentTurn = currentTurn === "team1" ? "team2" : "team1";

    if (lobby.captainPickState.unpickedPlayers.length === 0) {
      await startMapVeto(lobby, matchId);
      return;
    }

    await lobby.save();
    broadcastLobbyUpdate(matchId, lobby.toObject());
  }
}

// ─── Map veto ─────────────────────────────────────────────────────────────────

export async function startMapVeto(lobby: ILobby, matchId: string) {
  // Workshop maps skip veto entirely — go straight to server start
  if (lobby.settings.workshopMapId) {
    await finalizeLobbyAndStartServer(lobby, matchId);
    return;
  }

  lobby.phase = "map_veto";
  lobby.mapVetoState = {
    remainingMaps: [...CS2_MAPS],
    vetoHistory: [],
    currentTurn: lobby.coinFlipWinner ?? "team1",
  };

  await lobby.save();
  broadcastLobbyUpdate(matchId, lobby.toObject());
}

// Schedules a single bot veto turn after a short delay, then re-schedules if still a bot's turn
export function scheduleBotVeto(matchId: string) {
  setTimeout(async () => {
    const lobby = await Lobby.findOne({ matchId });
    if (!lobby || lobby.phase !== "map_veto" || !lobby.mapVetoState) return;

    const { currentTurn, remainingMaps } = lobby.mapVetoState;
    const currentCaptain = lobby.players.find(
      (p: LobbyPlayer) => p.isCaptain && p.team === currentTurn
    );
    if (!currentCaptain?.steamId.startsWith("bot-")) return;

    const banned = remainingMaps[Math.floor(Math.random() * remainingMaps.length)];
    lobby.mapVetoState.vetoHistory.push({ team: currentTurn, map: banned, action: "ban" });
    lobby.mapVetoState.remainingMaps = remainingMaps.filter(m => m !== banned);
    lobby.mapVetoState.currentTurn = currentTurn === "team1" ? "team2" : "team1";

    if (lobby.mapVetoState.remainingMaps.length === 1) {
      await finalizeLobbyAndStartServer(lobby, matchId);
    } else {
      await lobby.save();
      broadcastLobbyUpdate(matchId, lobby.toObject());
      scheduleBotVeto(matchId);
    }
  }, 1000);
}

// ─── Server start ─────────────────────────────────────────────────────────────

export async function finalizeLobbyAndStartServer(lobby: ILobby, matchId: string) {
  if (lobby.phase === "starting") return; // Idempotency guard

  const blocker = validateLobbyCanStart(lobby);
  if (blocker) {
    broadcastLobbyUpdate(matchId, { ...lobby.toObject(), startBlocked: blocker });
    return;
  }

  // Workshop maps use a built-in map for Docker STARTING_MAP (CS2 can't load workshop by name).
  // The plugin will switch to the workshop map via host_workshop_map after receiving config.
  const map = lobby.settings.workshopMapId
    ? "de_mirage"
    : (lobby.mapVetoState?.remainingMaps[0] ?? lobby.settings.mapPool?.[0] ?? "de_mirage");

  lobby.phase = "starting";
  await lobby.save();
  broadcastLobbyUpdate(matchId, { ...lobby.toObject(), starting: true });

  const { createServer } = await import("@/src/backend/services/gameServerService");
  const match = await Match.findById(matchId);
  if (!match) return;

  try {
    const server = await createServer(match.gameType, map, matchId);
    match.status = "configuring";
    match.gameId = server.gameId;
    match.apiPort = server.apiPort;
    match.connectionIp = server.connectionIp;
    match.connectionPort = server.connectionPort;
    await match.save();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Lobby] Failed to start server for match ${matchId}:`, message);
    match.status = "cancelled";
    await match.save();
    broadcastLobbyUpdate(matchId, { error: "Failed to start game server", details: message });
  }
}