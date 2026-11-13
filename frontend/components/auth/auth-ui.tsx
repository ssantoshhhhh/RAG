import { cn } from "@/lib/utils";

export const authCard = "w-full border border-[#e4e0f2] bg-white p-6 sm:p-8";
export const authLabel =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500";
export const authMicro =
  "font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-neutral-500";
export const authInput =
  "h-12 rounded-none border-0 bg-[#f0eef9] pl-10 pr-4 text-[15px] text-neutral-950 shadow-none transition-none placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-900 focus-visible:ring-offset-0";
export const authButton =
  "h-12 w-full justify-between rounded-none border border-black bg-black px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-none hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2";
export const authIcon =
  "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400";

export function AuthMeta({ label, right }: { label: string; right?: string }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#d91e4a]">
        <span className="h-1.5 w-1.5 bg-[#d91e4a]" />
        {label}
      </span>
      {right ? <span className={authMicro}>{right}</span> : null}
    </div>
  );
}

export function AuthBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-[#d91e4a] px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-[#d91e4a]">
      {children}
    </span>
  );
}

export function AuthStatusStrip({
  left,
  right,
  accent = "red",
}: {
  left: string;
  right: string;
  accent?: "red" | "black";
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-4 border border-[#e4e0f2] bg-[#f0eef9] px-3 py-2.5">
      <span className={cn("flex items-center gap-2", authMicro)}>
        <span
          className={cn(
            "h-1.5 w-1.5",
            accent === "red" ? "bg-[#d91e4a]" : "bg-neutral-900",
          )}
        />
        {left}
      </span>
      <span className={authMicro}>{right}</span>
    </div>
  );
}