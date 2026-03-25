import { cn } from "@/src/lib/helpers/utils";

export function PageTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={cn("font-display text-3xl font-bold tracking-tight text-[var(--foreground)]", className)}>
      {children}
    </h1>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("font-display text-lg font-semibold text-[var(--foreground)]", className)}>
      {children}
    </h2>
  );
}

export function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-sm text-[var(--muted)]", className)}>
      {children}
    </p>
  );
}