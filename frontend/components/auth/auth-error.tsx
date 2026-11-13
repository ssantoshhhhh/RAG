import { AlertCircle } from "lucide-react";

export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2.5 border border-[#d91e4a] bg-[#fff1f4] px-3.5 py-3 text-sm text-[#a31136]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="font-mono text-[11px] leading-relaxed">{message}</p>
    </div>
  );
}