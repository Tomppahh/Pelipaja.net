"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SessionUser } from "@/src/backend/lib/session";

interface Props {
  user: SessionUser;
}

export default function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 text-[var(--foreground)]"
        type="button"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.avatarUrl}
          alt={user.displayName}
          width={48}
          height={48}
          className="h-12 w-12 rounded-full object-cover"
        />
        <span className="text-lg font-semibold leading-none text-[var(--foreground)]">{user.displayName}</span>
        <span className="ml-3 text-2xl leading-none text-[var(--foreground)]">☰</span>
      </button>

      {open && (
        <div className="absolute right-0 min-w-[150px] rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-md">
          <Link href="/" className="block px-4 py-2 text-[var(--foreground)] hover:bg-[var(--surface-hover)]">
            Home
          </Link>
          {user.role === "admin" && (
            <a href="/api/admin" className="block px-4 py-2 text-[var(--foreground)] hover:bg-[var(--surface-hover)]">
              Admin Panel
            </a>
          )}
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="block w-full px-4 py-2 text-left text-[var(--foreground)] hover:bg-[var(--surface-hover)]">
              Logout
            </button>
          </form>
        </div>
      )}
    </div>
  );
}