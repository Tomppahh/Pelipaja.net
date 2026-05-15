import { getSession } from '../backend/lib/session';
import {ROLES, hasRole} from "@/src/lib/config/settings"
import { connectDB } from '@/src/backend/lib/db';
import Lobby from '@/src/models/lobby';
import Match from '@/src/models/Match';

export default async function Home() {
	const user = await getSession();
	const { lobby } = ROLES;

	let myMatchId: string | null = null;
	if (user) {
		await connectDB();
		// Only consider lobbies where the user is an active participant
		const userLobby = await Lobby.findOne({ 'players.steamId': user.steamId }).select('matchId');
		if (userLobby) myMatchId = userLobby.matchId.toString();
	}

	return (
		<>
			<main className='flex min-h-screen flex-col items-center justify-center'>
				<h1 className='font-display text-5xl pb-10 font-bold text-[var(--foreground)]'>Welcome to Pelipaja</h1>
                
				{user && hasRole(user.role, lobby) && <a className="mt-16 inline-block rounded-lg bg-[var(--accent)] px-6 py-3 font-bold text-[var(--accent-contrast)] shadow-lg transition hover:brightness-110" href="/match">
					CREATE LOBBY
				</a>}

				{myMatchId && (
					<a className="mt-4 inline-block text-sm text-[var(--foreground)] underline" href={`/match/${myMatchId}/lobby`}>Go to my Lobby</a>
				)}
				<h4 className='font-display text-l font-bold  pt-50 text-[var(--foreground)]'>Still in active development, bugs may occur!</h4> 
                 <h4 className='font-display text-l font-bold text-[var(--foreground)]'>Lobby system may contain bugs, creating a server without lobby works!</h4>       
			</main>
		</>
	);
}
