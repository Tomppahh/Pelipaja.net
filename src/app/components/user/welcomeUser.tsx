"use client";

import { SessionUser } from "@/src/backend/lib/session";

interface Props {
  user: SessionUser | null;
}

export default function WelcomeUser({ user }: Props) {
  if (!user) return <a href="/api/auth/steam">Login</a>;
  return <p>Hello {user.displayName}</p>;
}