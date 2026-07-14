"use client";

export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex items-center">
      {children}
      <span className="group/tip relative ml-1 inline-flex">
        <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-bold text-[var(--muted)] select-none hover:border-[var(--foreground)]/40 hover:text-[var(--foreground)]">
          ?
        </span>
        <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-normal rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 w-52 text-center">
          {text}
        </span>
      </span>
    </span>
  );
}
