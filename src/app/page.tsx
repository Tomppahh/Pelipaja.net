import { getSession } from '../backend/lib/session';
import {ROLES, hasRole} from "@/src/lib/config/settings"
import { CreateLobbyButton } from "@/src/app/components/user/createLobbyButton";

export default async function Home() {
	const user = await getSession();
	const { lobby } = ROLES;

	return (
		<>
			<main className='flex min-h-screen flex-col items-center justify-center'>
				<h1 className='font-display text-5xl pb-10 font-bold text-[var(--foreground)]'>Welcome to Pelipaja</h1>
                
				{user && hasRole(user.role, lobby) && <CreateLobbyButton />}

			<p className='font-display text-l font-bold pt-32 text-[var(--foreground)]'>Create custom CS2 Matches with your friends!</p>
                <p className='font-display text-l font-bold text-[var(--foreground)]'>Login with Steam to create or join a lobby</p>       
			</main>
		</>
	);
}
