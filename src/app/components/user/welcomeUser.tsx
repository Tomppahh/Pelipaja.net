"use client";

import { SessionUser } from "@/src/backend/lib/session";

interface Props {
  user: SessionUser | null;
}

export default function WelcomeUser({ user }: Props) {
  if (!user) return <a href="/api/auth/steam" className="rounded-lg bg-[var(--accent)] px-3 py-1 text-sm font-semibold text-[var(--accent-contrast)]">Login</a>;
  return (
   <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    <span className="text-[var(--foreground)]">Hello {user.displayName}</span>;
    <img src={user?.avatarUrl} style={{ width: "48px", height: "48px", borderRadius: "50%"}}/>
      <form action="/api/auth/logout" method="POST">
          <button className="ml-[0px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[var(--foreground)]" type="submit">Logout</button>
        </form>
    </div>
  );
}
