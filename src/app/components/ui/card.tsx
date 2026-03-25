import { cn } from "@/src/lib/helpers/utils";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 sm:p-5", className)}>
      {children}
    </div>
  );
}