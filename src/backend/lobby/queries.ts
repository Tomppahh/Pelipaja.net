import { connectDB } from "@/src/backend/lib/db";
import Lobby, { ILobby } from "@/src/models/lobby";
import Match, { MatchStatus } from "@/src/models/Match";

const ONGOING_STATUSES: MatchStatus[] = ["configuring", "ready", "live"];

export type OngoingLobby = {
  matchId: string;
  lobbyName?: string;
  status: MatchStatus;
};

export async function getUserLobby(steamId: string): Promise<ILobby | null> {
  await connectDB();

  return (await Lobby.findOne({
    $or: [{ leaderId: steamId }, { "players.steamId": steamId }],
  })
    .sort({ updatedAt: -1 })
    .lean()) as unknown as ILobby | null;
}

export async function getOngoingLobbyForUser(
  steamId: string
): Promise<OngoingLobby | null> {
  const lobby = await getUserLobby(steamId);
  if (!lobby) return null;

  const match = await Match.findById(lobby.matchId).select("status").lean();
  const status = match?.status;
  if (!status || !ONGOING_STATUSES.includes(status)) return null;

  return {
    matchId: lobby.matchId.toString(),
    lobbyName: lobby.settings?.name,
    status,
  };
}
