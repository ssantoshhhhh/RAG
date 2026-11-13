"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-[#d91e4a]/30 bg-[#fff1f4]/60 px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center border border-[#d91e4a]/40 bg-white text-[#d91e4a]">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
        <p className="mx-auto max-w-md text-[13px] leading-6 text-neutral-600">
          {message ?? "Please try again."}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}