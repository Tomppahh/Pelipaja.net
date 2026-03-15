import { getSession } from "@/src/backend/lib/session"
import UserMenu from "../user/userMenu"; 
export default async function Header() {
	const user = await getSession();

	return (
		<header className='flex shadow-md py-4 px-4 sm:px-10 bg-white min-h-[70px] tracking-wide absolute w-full z-50'>
			<div className='flex flex-wrap items-center justify-between gap-5 w-full'>
				<a href='/' className='max-sm:hidden'>
					<h1 className='text-5xl font-bold italic font-franklin text-black'>Pelipaja.net</h1>
				</a>
				
			</div>
			{user ? <UserMenu user={user} /> : <a href="/api/auth/steam">Login</a>}
		</header>
	);
}
