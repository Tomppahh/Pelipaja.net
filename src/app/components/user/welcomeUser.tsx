"use client";

import { SessionUser } from "@/src/backend/lib/session";

interface Props {
  user: SessionUser | null;
}

export default function WelcomeUser({ user }: Props) {
  if (!user) return <a href="/api/auth/steam" className="text-black">Login</a>;
  return (
   <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
  <span className="text-black">Hello {user.displayName}</span>;
  <img
    src={user?.avatarUrl}
    style={{ width: "48px", height: "48px", borderRadius: "50%"}}
    />
    </div>
  );
}
