export default function About() {
  return (
    <section className='mx-auto max-w-3xl px-6 py-20'>
      <p className='text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]'>About</p>
      <h1 className='mt-3 font-display text-4xl font-bold text-[var(--foreground)] sm:text-5xl'>
        Built for playing with friends and enjoying custom community matches.
      </h1>
      <p className='mt-5 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg'>
        Pelipaja is a free community platform for competitive CS2 matchmaking.
        Create lobbies, spin up game servers automatically, and play — with as little friction as possible.
      </p>

      <div className='mt-12 grid gap-8 sm:grid-cols-3'>
        <div>
          <h2 className='text-base font-semibold text-[var(--foreground)]'>Lobby Creation</h2>
          <p className='mt-1 text-sm leading-relaxed text-[var(--muted)]'>
            Create public or private matches. Captain pick, map veto, and team shuffle built in.
          </p>
        </div>
        <div>
          <h2 className='text-base font-semibold text-[var(--foreground)]'>Automation</h2>
          <p className='mt-1 text-sm leading-relaxed text-[var(--muted)]'>
            Game servers spin up when you start and shut down when you finish. No manual setup.
          </p>
        </div>
        <div>
          <h2 className='text-base font-semibold text-[var(--foreground)]'>Flexible Teams & Maps</h2>
          <p className='mt-1 text-sm leading-relaxed text-[var(--muted)]'>
            Any team size, official maps or Steam Workshop maps. Captain pick and map veto included.
          </p>
        </div>
      </div>
    </section>
  );
}
