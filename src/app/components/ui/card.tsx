import { cn } from "@/src/lib/helpers/utils";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-700 bg-slate-800/40 p-4 sm:p-5", className)}>
      {children}
    </div>
  );
}