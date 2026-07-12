export default function About() {
  return (
    <section className='flex min-h-[calc(100vh-88px)] items-center justify-center px-6 py-16'>
      <div className='w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--surface)]/85 p-8 shadow-2xl shadow-black/20 backdrop-blur'>
        <p className='font-body text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]'>About Pelipaja</p>
        <h1 className='font-display text-4xl font-bold text-[var(--foreground)] sm:text-5xl'>
          Built for playing with friends and enjoying custom community matches.
        </h1>
        <p className='mt-4 max-w-2xl text-base text-[var(--muted)] sm:text-lg'>
          Pelipaja is a community matchmaking platform where you can create match lobbies with your friends. 
          Choose teamsize, create a lobby and enjoy a fully automated game of Counter-Strike with your friends!
        </p>
        <div className='mt-8 grid gap-4 sm:grid-cols-3'>
          <div className='rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 p-4'>
            <h2 className='text-lg font-semibold text-[var(--foreground)]'>Lobby Creation</h2>
            <p className='mt-2 text-sm text-[var(--muted)]'>Create public or private matches with friends. </p>
          </div>
          <div className='rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 p-4'>
            <h2 className='text-lg font-semibold text-[var(--foreground)]'>Automation</h2>
            <p className='mt-2 text-sm text-[var(--muted)]'>You dont need to worry about anything! Lobby, Match and Gameserver creation is completely automated!
            </p>
          </div>
          <div className='rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 p-4'>
            <h2 className='text-lg font-semibold text-[var(--foreground)]'>Dynamic Team size and workshop map support</h2>
            <p className='mt-2 text-sm text-[var(--muted)]'>Want to play competitive maps from the active map pool? sure! Map veto and captain pick team functionality does the job.
              Want to play a workshop map 1v1 against a friend?
              Just link a workshop map url straight from steam workshop and have fun in custom maps you want to enjoy!</p>
          </div>
        </div>
      </div>
    </section>
  );
}