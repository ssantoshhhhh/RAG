"use client";

import { FileText, Sparkles } from "lucide-react";

import type { Message, Source } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
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
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          isUser
            ? "bg-slate-900 text-white"
            : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white",
        )}
      >
        {isUser ? initials(userName) : <Sparkles className="h-3.5 w-3.5" />}
      </span>

      <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-2", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-md bg-indigo-600 text-white"
              : "rounded-tl-md border border-border bg-card text-slate-800 shadow-sm",
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 px-1",
            isUser ? "justify-end" : "justify-start",
          )}
        >
          <span className="text-[11px] text-muted-foreground">
            {formatTime(message.created_at)}
          </span>
          {!isUser && message.sources && message.sources.length > 0 ? (
            <>
              <span className="text-[11px] text-slate-300">·</span>
              {message.sources.map((source, index) => (
                <button
                  key={`${source.chunk_id}-${index}`}
                  type="button"
                  onClick={() => onSourceClick(source)}
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                  title={source.excerpt}
                >
                  <FileText className="h-3 w-3" />
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