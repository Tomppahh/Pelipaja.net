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

  const map =
    (match.gameConfig as Record<string, unknown> | undefined)?.map ??
    lobby?.settings.workshopMapName ??
    lobby?.settings.map ??
    lobby?.mapVetoState?.remainingMaps?.[0] ??
    lobby?.settings.mapPool?.[0];

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
