import Image from "next/image";

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-bg-rem.png"
      alt="RAG — Retrieval-Augmented Generation"
      width={494}
      height={505}
      className={cn("h-12 w-auto", className)}
    />
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-white",
        className,
      )}
    >
      <Image
        src="/logo.png"
        alt=""
        width={594}
        height={608}
        className="h-full w-full object-contain"
      />
    </span>
  );
}