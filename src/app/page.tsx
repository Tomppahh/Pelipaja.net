import { getSession } from '../backend/lib/session';
import {ROLES, hasRole} from "@/src/lib/config/settings"
import { connectDB } from '@/src/backend/lib/db';
import Lobby from '@/src/models/lobby';
import { CreateLobbyButton } from "@/src/app/components/user/createLobbyButton";

export default async function Home() {
	const user = await getSession();
	const { lobby } = ROLES;

	let myMatchId: string | null = null;
	let publicLobbies: { matchId: string; name?: string; mode: string; teamSize: number; playerCount: number; capacity: number; hasPassword: boolean; leaderName: string; workshopMapName?: string }[] = [];

	await connectDB();

	if (user) {
		const userLobby = await Lobby.findOne({ 'players.steamId': user.steamId }).select('matchId');
		if (userLobby) myMatchId = userLobby.matchId.toString();
	}

	publicLobbies = await Lobby.find({ "settings.isPublic": true, phase: "waiting" })
		.sort({ createdAt: -1 })
		.limit(10)
		.select("matchId leaderId settings players")
		.lean()
		.then(lobbies => lobbies.map(lobby => {
			const playerCount = lobby.players.length;
			const capacity = lobby.settings.teamSize * 2;
			const leader = lobby.players.find((p: { steamId: string }) => p.steamId === lobby.leaderId);
			return {
				matchId: lobby.matchId.toString(),
				name: lobby.settings.name,
				mode: lobby.settings.mode,
				teamSize: lobby.settings.teamSize,
				playerCount,
				capacity,
				hasPassword: !!lobby.settings.password,
				leaderName: leader?.displayName ?? "Unknown",
				workshopMapName: lobby.settings.workshopMapName,
			};
		}));

	return (
		<>
			<main className='flex min-h-screen flex-col items-center justify-center'>
				<h1 className='font-display text-5xl pb-10 font-bold text-[var(--foreground)]'>Welcome to Pelipaja</h1>
                
				{user && hasRole(user.role, lobby) && <CreateLobbyButton />}

				{myMatchId && (
					<a className="mt-4 inline-block text-sm text-[var(--foreground)] underline" href={`/match/${myMatchId}/lobby`}>Go to my Lobby</a>
				)}

				{publicLobbies.length > 0 && (
					<div className="mt-10 w-full max-w-2xl px-4">
						<h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Open Lobbies</h2>
						<div className="grid gap-3">
							{publicLobbies.map((lobby) => (
								<a
									key={lobby.matchId}
									href={`/match/${lobby.matchId}/lobby`}
									className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:bg-[var(--surface-hover)]"
								>
									<div>
										<span className="font-semibold text-[var(--foreground)]">{lobby.name || `${lobby.mode} Lobby`}</span>
										<span className="ml-2 text-sm text-[var(--muted)]">{lobby.mode} · {lobby.teamSize}v{lobby.teamSize}</span>
										{lobby.workshopMapName && <span className="ml-2 text-xs text-[var(--muted)]">({lobby.workshopMapName})</span>}
										{lobby.hasPassword && <span className="ml-2 text-xs text-yellow-500">🔒</span>}
									</div>
									<div className="text-sm text-[var(--muted)]">
										{lobby.playerCount}/{lobby.capacity}
									</div>
								</a>
							))}
						</div>
						<a href="/lobbies" className="mt-3 block text-center text-sm text-[var(--muted)] underline">View all</a>
					</div>
				)}

				<h4 className='font-display text-l font-bold  pt-50 text-[var(--foreground)]'>Create custom CS2 Matches with your friends!</h4> 
                <h4 className='font-display text-l font-bold  text-[var(--foreground)]'>Login with Steam to create or join a lobby</h4>       
			</main>
		</>
	);
}
