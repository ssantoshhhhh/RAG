"use client";

import { MessageSquare, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { Conversation } from "@/lib/types";
import { cn, formatRelativeTime } from "@/lib/utils";

export function ConversationPanel({
  conversations,
  loading,
  activeId,
  onNew,
  onRename,
  onDelete,
  onNavigate,
}: {
  conversations: Conversation[] | undefined;
  loading: boolean;
  activeId?: string;
  onNew: () => void;
  onRename: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 py-3.5">
        <h2 className="text-sm font-semibold text-slate-900">Conversations</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="New conversation"
          onClick={onNew}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="space-y-2 px-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="space-y-1.5 py-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            ))}
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <MessageSquare className="h-4.5 w-4.5" />
            </span>
            <p className="text-sm font-medium text-slate-900">No conversations yet</p>
            <p className="text-xs text-muted-foreground">
              Ask your first question to start a thread.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conversation) => {
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-xl pr-1 transition-colors",
                      active ? "bg-indigo-50" : "hover:bg-slate-50",
                    )}
                  >
                    <Link
                      href={`/app/chat/${conversation.id}`}
                      onClick={onNavigate}
                      className="min-w-0 flex-1 px-3 py-2.5"
                    >
                      <span
                        className={cn(
                          "block truncate text-sm",
                          active
                            ? "font-medium text-indigo-700"
                            : "font-medium text-slate-700",
                        )}
                      >
                        {conversation.title}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {formatRelativeTime(
                          conversation.last_message_at ?? conversation.updated_at,
                        )}
                      </span>
                    </Link>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:data-[state=open]:opacity-100"
                          aria-label={`Actions for ${conversation.title}`}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => onRename(conversation)}>
                          <Pencil />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onSelect={() => onDelete(conversation)}>
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        Conversations are saved automatically.
      </p>
    </div>
  );
}