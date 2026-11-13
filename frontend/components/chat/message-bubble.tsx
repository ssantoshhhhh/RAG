"use client";

import { FileText } from "lucide-react";

import { LogoMark } from "@/components/logo";
import type { Message, Source } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({
  message,
  userName,
  onSourceClick,
}: {
  message: Message;
  userName: string;
  onSourceClick: (source: Source) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {isUser ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-neutral-950 font-mono text-[10px] font-semibold text-white">
          {initials(userName)}
        </span>
      ) : (
        <LogoMark className="h-8 w-8 border border-neutral-300" />
      )}

      <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-1.5", isUser && "items-end")}>
        <div
          className={cn(
            "px-4 py-2.5 text-[13px] leading-6",
            isUser
              ? "bg-neutral-950 text-white"
              : "border border-neutral-200 bg-white text-neutral-800",
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 px-0.5",
            isUser ? "justify-end" : "justify-start",
          )}
        >
          <span className="font-mono text-[9.5px] text-neutral-400">
            {formatTime(message.created_at)}
          </span>
          {!isUser && message.sources && message.sources.length > 0 ? (
            <>
              <span className="text-[10px] text-neutral-300">·</span>
              {message.sources.map((source, index) => (
                <button
                  key={`${source.chunk_id}-${index}`}
                  type="button"
                  onClick={() => onSourceClick(source)}
                  className="inline-flex items-center gap-1.5 border border-neutral-200 bg-white px-2 py-1 font-mono text-[9px] text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-950"
                  title={source.excerpt}
                >
                  <FileText className="h-3 w-3 text-[#d91e4a]" />
                  {source.filename} · p.{source.page_number}
                </button>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}