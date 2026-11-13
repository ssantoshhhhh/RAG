import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 border border-dashed border-neutral-300 bg-white px-6 py-14 text-center",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center border border-neutral-200 bg-neutral-50 text-neutral-500">
        <Icon className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
        <p className="mx-auto max-w-md text-[13px] leading-6 text-neutral-500">{description}</p>
      </div>
      {action}
    </div>
  );
}