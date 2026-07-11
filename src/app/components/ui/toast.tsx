"use client";

import { cn } from "@/src/lib/helpers/utils";

type ToastVariant = "error" | "success" | "info";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
}

const variantClasses: Record<ToastVariant, string> = {
  error:   "border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]",
  success: "border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]",
  info:    "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]",
};

export function Toast({ message, variant = "error", onDismiss }: ToastProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur",
        variantClasses[variant]
      )}
    >
      <p className="flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold opacity-70 transition hover:opacity-100"
      >
        OK
      </button>
    </div>
  );
}
