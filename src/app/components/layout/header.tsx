import { getSession } from "@/src/backend/lib/session"
import UserMenu from "../user/userMenu"; 
export default async function Header() {
	const user = await getSession();

	return (
		<header className='fixed top-0 left-0 z-50 flex min-h-[70px] w-full bg-white px-4 py-4 tracking-wide shadow-md sm:px-10'>
			<div className='flex flex-wrap items-center justify-between gap-5 w-full'>
				<a href='/' className='max-sm:hidden'>
					<h1 className='text-5xl font-bold italic font-franklin text-black'>Pelipaja.net</h1>
				</a>
				
			</div>
			{user ? <UserMenu user={user} /> : <a href="/api/auth/steam">Login</a>}
		</header>
	);
}
