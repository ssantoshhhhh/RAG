import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
        <Sparkles className="h-4.5 w-4.5" />
      </span>
      {showText ? (
        <span className="text-[17px] font-semibold tracking-tight text-slate-900">
          DocuMind
        </span>
      ) : null}
    </div>
  );
}