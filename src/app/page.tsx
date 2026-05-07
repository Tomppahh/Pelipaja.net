import { getSession } from '../backend/lib/session';
import {ROLES, hasRole} from "@/src/lib/config/settings"
import { connectDB } from '@/src/backend/lib/db';
import Match from '@/src/models/Match';

export default async function Home() {
	const user = await getSession();
	const { lobby } = ROLES;

	let myMatchId: string | null = null;
	if (user) {
		await connectDB();
		const m = await Match.findOne({ 'gameConfig.ownerSteamID': user.steamId, status: { $in: ['pending','configuring','ready','live'] } }).select('_id');
		if (m) myMatchId = m._id.toString();
	}

	return (
		<>
			<main className='flex min-h-screen flex-col items-center justify-center'>
				<h1 className='font-display text-5xl font-bold text-[var(--foreground)]'>Pelipaja.net</h1>
                
				{user && hasRole(user.role, lobby) && <a className="mt-16 inline-block rounded-lg bg-[var(--accent)] px-6 py-3 font-bold text-[var(--accent-contrast)] shadow-lg transition hover:brightness-110" href="/match">
					CREATE MATCH
				</a>}

				{myMatchId && (
					<a className="mt-4 inline-block text-sm text-[var(--foreground)] underline" href={`/match/${myMatchId}`}>Go to my match</a>
				)}
                        
			</main>
		</>
	);
}
