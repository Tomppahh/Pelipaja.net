import Match from "@/src/models/Match";
import Lobby from "@/src/models/lobby";

type LobbyDoc = {
  players: Array<{ team: string; isCaptain?: boolean; displayName: string }>;
} | null | undefined;

export function getTeamName(lobby: LobbyDoc, team: "team1" | "team2"): string {
  if (!lobby) return team === "team1" ? "Team 1" : "Team 2";
  const captain = lobby.players.find(p => p.team === team && p.isCaptain);
  if (captain) return `Team ${captain.displayName}`;
  return team === "team1" ? "Team 1" : "Team 2";
}

// Builds the same JSON view of a match that GET /api/matches/[id] returns,
// so the SSE endpoint can emit an identical initial payload.
export async function getMatchView(
  id: string,
  user: { steamId?: string; role?: string } | null
) {
  const match = await Match.findById(id);
  if (!match) return null;

  const lobby = await Lobby.findOne({ matchId: id });

  // An explicitly chosen fixed map (settings.map) must win over the pool's
  // first entry. The pool fallback (de_mirage) previously caused a picked
  // map like de_dust2 to snap back to de_mirage on read. Only fall
  // back to the pool when no explicit map was chosen.
  // Resolution order:
  //   1. gameConfig.map          (legacy / non-lobby matches)
  //   2. settings.workshopMapName (workshop lobbies)
  //   3. settings.map           (explicitly chosen fixed map — authoritative)
  //   4. mapVetoState.remainingMaps[0] (result of a map veto)
  //   5. mapPool[0]  (de_mirage) — ONLY when no map was ever chosen.
  // An explicit settings.map must always beat the pool's first entry, otherwise a
  // picked map (e.g. de_dust2) silently falls back to de_mirage.
  const map =
    (match.gameConfig as Record<string, unknown> | undefined)?.map ??
    lobby?.settings.workshopMapName ??
    lobby?.settings.map ??
    lobby?.mapVetoState?.remainingMaps?.[0] ??
    (lobby?.settings.map ? undefined : lobby?.settings.mapPool?.[0]);

  const mode =
    (match.gameConfig as Record<string, unknown> | undefined)?.mode ?? lobby?.settings.mode;

  const { gameType, gameConfig, playersPerTeam, status, gameId, connectionIp, connectionPort } =
    match;

  const isOwner = !!user?.steamId && (gameConfig as Record<string, unknown>)?.ownerSteamID === user.steamId;
  const isAdmin = user?.role === "admin";
  const isLeader = !!user?.steamId && lobby?.leaderId === user.steamId;
  const isInLobby = lobby?.players.some((p) => p.steamId === user?.steamId) ?? false;
  const canCancel = Boolean(isAdmin || isLeader || (!lobby && isOwner));
  const canSeeConnection = isAdmin || isOwner || isLeader || isInLobby;

  if (isAdmin) {
    const full = typeof (match as unknown as { toObject?: () => object }).toObject === "function"
      ? (match as unknown as { toObject: () => object }).toObject()
      : { ...(match as unknown as object) };
    return { ...full, map, isOwner, isAdmin, leaderId: lobby?.leaderId, canCancel };
  }

  return {
    gameType,
    playersPerTeam,
    status,
    gameId,
    map,
    mode,
    ...(canSeeConnection ? { connectionIp, connectionPort } : {}),
    isOwner,
    isAdmin,
    leaderId: lobby?.leaderId,
    canCancel,
  };
}
