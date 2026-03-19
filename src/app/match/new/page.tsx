import { getSession } from "@/src/backend/lib/session";
import { ROLES, hasRole } from "@/src/lib/config/settings";
import { redirect } from "next/navigation";

export default async function CreateMatchPage() {
  const user = await getSession();
  const { lobby } = ROLES;

  if (!user) redirect("/login");
  if (!hasRole(user.role, lobby)) redirect("/");

  return (
    <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-3xl items-center justify-center px-4 py-8 sm:px-6">
      <section className="w-full rounded-2xl border border-slate-700/60 bg-slate-900/70 p-8 shadow-2xl backdrop-blur">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Create Match</h1>
        <p className="mt-2 text-slate-300">Select a game</p>

        <div className="mt-6">
          <a
            href="/match/new/cs2"
            className="inline-flex rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Counter-Strike 2
          </a>
        </div>
      </section>
    </main>
  );
}