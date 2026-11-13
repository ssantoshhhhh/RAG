import type { DocumentStatus } from "@/lib/types";
import { statusLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STYLES: Record<
  DocumentStatus,
  { box: string; dot: string }
> = {
  UPLOADED: { box: "border-neutral-300 text-neutral-600", dot: "bg-neutral-400" },
  PROCESSING: { box: "border-amber-300 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  INDEXING: { box: "border-sky-300 bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  INDEXED: { box: "border-neutral-300 text-neutral-900", dot: "bg-[#d91e4a]" },
  FAILED: { box: "border-[#d91e4a] bg-[#fff1f4] text-[#a31136]", dot: "bg-[#d91e4a]" },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const style = STYLES[status] ?? STYLES.UPLOADED;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em]",
        style.box,
      )}
    >
      <span className={cn("h-1.5 w-1.5", style.dot)} />
      {statusLabel(status)}
    </span>
  );
}