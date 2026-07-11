"use client";

import { useRouter } from "next/navigation";

export function CreateLobbyButton() {
  const router = useRouter();

  return (
    <div className="mt-16 flex flex-col items-center gap-3">
      <button
        onClick={() => router.push("/match/new/cs2")}
        className="inline-block rounded-lg bg-[var(--accent)] px-6 py-3 font-bold text-[var(--accent-contrast)] shadow-lg transition hover:brightness-110"
      >
        Create Lobby
      </button>
    </div>
  );
}
