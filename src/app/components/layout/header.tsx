import { getSession } from "@/src/backend/lib/session"
import UserMenu from "../user/userMenu"; 
export default async function Header() {
	const user = await getSession();

	return (
		<header className='fixed top-0 left-0 z-50 flex min-h-[70px] w-full border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-4 tracking-wide shadow-md backdrop-blur sm:px-10'>
			<div className='flex flex-wrap items-center justify-between gap-5 w-full'>
				<a href='/' className='max-sm:hidden'>
					<h1 className='font-display text-5xl font-bold'>Pelipaja.net</h1>
				</a>
				
			</div>
			{user ? <UserMenu user={user} /> : <a href="/api/auth/steam" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] transition hover:brightness-110">Login</a>}
		</header>
	);
}
