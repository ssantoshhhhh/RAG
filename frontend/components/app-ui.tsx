import { cn } from "@/lib/utils";

export const monoLabel =
  "font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500";
export const monoMicro =
  "font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500";
export const panel = "border border-neutral-200 bg-white";

export function RedDot({ className }: { className?: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 shrink-0 bg-[#d91e4a]", className)} />;
}

export function MicroLabel({
  children,
  className,
  dot,
}: {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", monoLabel, className)}>
      {dot ? <RedDot /> : null}
      {children}
    </span>
  );
}