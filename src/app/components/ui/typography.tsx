import { cn } from "@/src/lib/helpers/utils";

export function PageTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={cn("text-3xl font-bold tracking-tight text-slate-100", className)}>
      {children}
    </h1>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-lg font-semibold text-slate-100", className)}>
      {children}
    </h2>
  );
}

export function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-sm text-slate-400", className)}>
      {children}
    </p>
  );
}