import { getSession } from '../backend/lib/session';
import {ROLES, hasRole} from "@/src/lib/config/settings"
export default async function Home() {
	const user = await getSession();
	const { lobby } = ROLES;
	return (
		<>
			<main className='flex min-h-screen flex-col items-center justify-center'>
				<h1 className='text-5xl font-bold italic font-franklin'>Pelipaja.net</h1>
				
				{user && hasRole(user.role, lobby) && <a className="mt-16 inline-block rounded-lg bg-emerald-600 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-emerald-500" href="/match">
					CREATE MATCH
				</a>}
						
			</main>
		</>
	);
}
