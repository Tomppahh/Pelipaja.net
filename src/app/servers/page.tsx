import { CommunityServerStatus } from "@/src/app/components/communityServerStatus";

export default function ServersPage() {
  return (
    <main className="flex min-h-screen flex-col items-center pt-24 px-4">
      <h1 className="font-display text-4xl font-bold text-[var(--foreground)] mb-4">24/7 Servers</h1>
      <p className="text-[var(--muted)] text-center max-w-xl mb-8">
        Free to join community servers running around the clock. Jump in anytime — no lobby needed.
        Current map rotation includes sauna classics.
      </p>
      <CommunityServerStatus />
    </main>
  );
}
