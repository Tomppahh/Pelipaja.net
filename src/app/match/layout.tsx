import React from "react";

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-8 shadow-2xl backdrop-blur">
        {children}
      </div>
    </div>
  );
}