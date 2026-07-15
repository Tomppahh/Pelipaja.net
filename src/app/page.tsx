import Link from 'next/link';
import { getSession } from '../backend/lib/session';
import { ROLES, hasRole } from "@/src/lib/config/settings";
import { CreateLobbyButton } from "@/src/app/components/user/createLobbyButton";
import { connectDB } from '@/src/backend/lib/db';
import Match from '@/src/models/Match';
import MatchResult from '@/src/models/MatchResult';
import User from '@/src/models/User';

export default async function Home() {
	const user = await getSession();
	const { lobby } = ROLES;

	let stats = { matches: 0, players: 0, lobbies: 0 };

	try {
		await connectDB();
		const [matches, players, lobbies] = await Promise.all([
			MatchResult.countDocuments(),
			User.countDocuments(),
			Match.countDocuments({ status: { $in: ["pending", "configuring", "ready", "live"] } }),
		]);
		stats = { matches, players, lobbies };
	} catch {}

	return (
		<main className='flex min-h-screen flex-col items-center justify-center px-4'>
			<section className='text-center max-w-2xl'>
				<h1 className='font-display text-5xl sm:text-6xl font-bold text-[var(--foreground)]'>
					Pelipaja
				</h1>
				<p className='mt-4 text-lg text-[var(--muted)]'>
					Competitive CS2 matchmaking with your friends.
					Create lobbies, pick maps, and play — all automated.
				</p>

				<div className='mt-8 flex justify-center gap-4'>
					{user && hasRole(user.role, lobby) ? (
						<CreateLobbyButton />
					) : (
						<a href="/api/auth/steam" className="inline-flex items-center rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-bold uppercase tracking-wider text-[var(--accent-contrast)] transition hover:opacity-90">
							Get Started
						</a>
					)}
					<Link href="/servers" className="inline-flex items-center rounded-lg border border-[var(--border)] px-6 py-3 text-sm font-bold uppercase tracking-wider text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]">
						24/7 Servers
					</Link>
				</div>
			</section>

			<section className='mt-20 w-full max-w-3xl grid gap-6 sm:grid-cols-3'>
				<div className='rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5'>
					<h2 className='text-base font-semibold text-[var(--foreground)]'>Custom Lobbies</h2>
					<p className='mt-1 text-sm leading-relaxed text-[var(--muted)]'>
						Create public or private matches. Captain pick, map veto, and any team size.
					</p>
				</div>
				<div className='rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5'>
					<h2 className='text-base font-semibold text-[var(--foreground)]'>Auto Servers</h2>
					<p className='mt-1 text-sm leading-relaxed text-[var(--muted)]'>
						Game servers spin up when you start and shut down when you finish. No setup needed.
					</p>
				</div>
				<div className='rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5'>
					<h2 className='text-base font-semibold text-[var(--foreground)]'>Workshop Maps</h2>
					<p className='mt-1 text-sm leading-relaxed text-[var(--muted)]'>
						Play official maps or Steam Workshop maps. Host your own collections.
					</p>
				</div>
			</section>

			<section className='mt-12 flex gap-10 text-center'>
				<div>
					<p className='text-2xl font-bold text-[var(--foreground)]'>{stats.matches}</p>
					<p className='text-sm text-[var(--muted)]'>Matches Played</p>
				</div>
				<div>
					<p className='text-2xl font-bold text-[var(--foreground)]'>{stats.players}</p>
					<p className='text-sm text-[var(--muted)]'>Players</p>
				</div>
				<div>
					<p className='text-2xl font-bold text-[var(--foreground)]'>{stats.lobbies}</p>
					<p className='text-sm text-[var(--muted)]'>Active Lobbies</p>
				</div>
			</section>
		</main>
	);
}
