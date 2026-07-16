import { getSession } from '../backend/lib/session';
import { ROLES, hasRole } from "@/src/lib/config/settings";
import { CreateLobbyButton } from "@/src/app/components/user/createLobbyButton";
import { connectDB } from '@/src/backend/lib/db';
import MatchResult from '@/src/models/MatchResult';
import User from '@/src/models/User';

export default async function Home() {
	const user = await getSession();
	const { lobby } = ROLES;

	let stats = { matches: 0, players: 0, hours: 0, maps: 0 };

	try {
		await connectDB();
		const [matches, players, durationResult, mapsPlayed] = await Promise.all([
			MatchResult.countDocuments(),
			User.countDocuments(),
			MatchResult.aggregate([{ $group: { _id: null, total: { $sum: "$duration" } } }]),
			MatchResult.distinct("map"),
		]);
		const totalSeconds = durationResult[0]?.total ?? 0;
		stats = {
			matches,
			players,
			hours: Math.round(totalSeconds / 3600),
			maps: mapsPlayed.length,
		};
	} catch {}

	return (
		<main className='flex min-h-screen flex-col items-center justify-center px-4'>
			<section className='text-center max-w-2xl'>
				<h1 className='font-display text-5xl sm:text-6xl font-bold text-[var(--foreground)]'>
					Pelipaja.net
				</h1>
				<p className='mt-4 text-lg text-[var(--muted)]'>
					Competitive CS2 matchmaking with your friends.
					Create lobbies, pick maps, and play — all automated.
					And completely free!
				</p>

				<div className='mt-8 flex justify-center'>
					{user && hasRole(user.role, lobby) ? (
						<CreateLobbyButton />
					) : (
						<a href="/api/auth/steam" className="inline-flex items-center rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-bold uppercase tracking-wider text-[var(--accent-contrast)] transition hover:opacity-90">
							Get Started
						</a>
					)}
				</div>
			</section>

			<section className='mt-20 w-full max-w-5xl grid gap-6 sm:grid-cols-4'>
				<div className='xl border border-[var(--border)] bg-[var(--surface)] p-5'>
					<h2 className='text-base font-semibold text-[var(--foreground)]'>Custom Lobbies</h2>
					<p className='mt-1 text-sm leading-relaxed text-[var(--muted)]'>
						Create public or private matches. Captain pick, map veto, and any team size.
					</p>
				</div>
				<div className='xl border border-[var(--border)] bg-[var(--surface)] p-5'>
					<h2 className='text-base font-semibold text-[var(--foreground)]'>Auto Servers</h2>
					<p className='mt-1 text-sm leading-relaxed text-[var(--muted)]'>
						Game servers spin up when you start and shut down when you finish. No setup needed.
					</p>
				</div>
				<div className='xl border border-[var(--border)] bg-[var(--surface)] p-5'>
					<h2 className='text-base font-semibold text-[var(--foreground)]'>Workshop Maps</h2>
					<p className='mt-1 text-sm leading-relaxed text-[var(--muted)]'>
						Play official maps or Steam Workshop maps. Host your own collections.
					</p>
				</div><div className='xl border border-[var(--border)] bg-[var(--surface)] p-5'>
					<h2 className='text-base font-semibold text-[var(--foreground)]'>See how you play</h2>
					<p className='mt-1 text-sm leading-relaxed text-[var(--muted)]'>
						Match history & Personal Statistics generated from public 5v5 games.
					</p>
				</div>
			</section>

			<section className='mt-16 w-full max-w-3xl text-center'>
				<h2 className='text-sm font-semibold uppercase tracking-widest text-[var(--muted)] mb-6'>By the Numbers</h2>
				<div className='flex justify-center gap-16'>
					<div>
						<p className='text-2xl font-bold text-[var(--foreground)]'>{stats.matches}</p>
						<p className='text-sm text-[var(--muted)]'>Total Matches Played</p>
					</div>
					<div>
						<p className='text-2xl font-bold text-[var(--foreground)]'>{stats.players}</p>
						<p className='text-sm text-[var(--muted)]'>Registered Players</p>
					</div>
					<div>
						<p className='text-2xl font-bold text-[var(--foreground)]'>{stats.hours}</p>
						<p className='text-sm text-[var(--muted)]'>Total Hours Played</p>
					</div>
					<div>
						<p className='text-2xl font-bold text-[var(--foreground)]'>{stats.maps}</p>
						<p className='text-sm text-[var(--muted)]'>Unique Maps Played</p>
					</div>
				</div>
			</section>
		</main>
	);
}
