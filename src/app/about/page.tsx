export default function About() {
  return (
    <section className='flex min-h-[calc(100vh-88px)] items-center justify-center px-6 py-16'>
      <div className='w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--surface)]/85 p-8 shadow-2xl shadow-black/20 backdrop-blur'>
        <p className='font-body text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]'>About Pelipaja</p>
        <h1 className='font-display text-4xl font-bold text-[var(--foreground)] sm:text-5xl'>
          Built for fast, organized CS2 matches.
        </h1>
        <p className='mt-4 max-w-2xl text-base text-[var(--muted)] sm:text-lg'>
          Pelipaja is a community matchmaking platform for competitive CS2 5v5 games. It
          helps players create lobbies, spin up game servers automatically, and get from
          game lobby to match with as little friction as possible. And the best part: Its completely free!
        </p>
        <div className='mt-8 grid gap-4 sm:grid-cols-3'>
          <div className='rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 p-4'>
            <h2 className='text-lg font-semibold text-[var(--foreground)]'>Matchmaking</h2>
            <p className='mt-2 text-sm text-[var(--muted)]'>Create or join lobbies and keep the match flow clear for everyone.</p>
          </div>
          <div className='rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 p-4'>
            <h2 className='text-lg font-semibold text-[var(--foreground)]'>Automation</h2>
            <p className='mt-2 text-sm text-[var(--muted)]'>Game servers are provisioned and torn down automatically.</p>
          </div>
          <div className='rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 p-4'>
            <h2 className='text-lg font-semibold text-[var(--foreground)]'>Built for teams</h2>
            <p className='mt-2 text-sm text-[var(--muted)]'>Designed to make organized 5v5 play feel simple and reliable.</p>
          </div>
        </div>
      </div>
    </section>
  );
}