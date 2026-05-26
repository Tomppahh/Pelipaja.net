import { getSession } from "@/src/backend/lib/session"
import UserMenu from "../user/userMenu";

function NavLink({ href, children, plain }: { href: string; children: React.ReactNode; plain?: boolean }) {
    return (
        <a
            href={href}
            className={`flex h-full items-center border-r border-[var(--border)] px-6 transition-colors duration-200 hover:bg-[var(--border)]/30 ${!plain && 'text-sm font-semibold uppercase tracking-widest'}`}
        >
            {children}
        </a>
    );
}

export default async function Header() {
    const user = await getSession();
    return (
        <header className='fixed top-0 left-0 z-50 flex min-h-[70px] w-full items-center border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 tracking-wide shadow-md backdrop-blur'>
            <nav className='flex items-center self-stretch '>
				<NavLink href='/' plain><h1 className='font-display text-5xl font-bold'>Pelipaja.net</h1></NavLink>
				<NavLink href='/about'>About</NavLink>
                {/* Add more routes here */}
            </nav>

            <div className='ml-auto'>
                {user ? (
                    <UserMenu user={user} />
                ) : (
                    <a href="/api/auth/steam" className="group relative flex h-[50px] w-[270px] shrink-0 overflow-hidden rounded bg-[var(--accent)] text-[var(--accent-contrast)]">
                        <span className="absolute inset-0 flex items-center justify-center pr-8 text-xs font-bold uppercase tracking-widest transition-all duration-300 group-hover:-translate-x-full">
                            Login With Steam
                        </span>
                        <div className="absolute inset-0 flex translate-x-24 items-center justify-center transition-all duration-300 group-hover:translate-x-0">
                            <svg className="size-7" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.497 1.009 2.453-.4.957-1.497 1.41-2.455 1.014zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.662 0 3.015-1.35 3.015-3.015zm-5.273.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
                            </svg>
                        </div>
                    </a>
                )}
            </div>
        </header>
    );
}

