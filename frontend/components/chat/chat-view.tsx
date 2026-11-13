"use client";

import {
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  SendHorizonal,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConversationPanel } from "@/components/chat/conversation-panel";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ScopeDialog } from "@/components/chat/scope-dialog";
import { SourceDialog } from "@/components/chat/source-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  useAsk,
  useConversation,
  useConversations,
  useDeleteConversation,
  useDocuments,
  useMe,
  useRenameConversation,
} from "@/lib/queries";
import type { Conversation, Source } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

const SUGGESTIONS = [
  "Summarize the key findings",
  "What are the main topics covered?",
  "List the important names, dates, and figures",
];

function ThinkingBubble({ question, userName }: { question: string; userName: string }) {
  return (
    <>
      <div className="flex flex-row-reverse gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
          {initials(userName)}
        </span>
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-indigo-600 px-4 py-3 text-sm leading-relaxed text-white">
          <p className="whitespace-pre-wrap break-words">{question}</p>
        </div>
      </div>
      <div className="flex flex-row gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />
          </span>
          Searching your documents…
        </div>
      </div>
    </>
  );
}

export function ChatView({
  conversationId,
  initialDocumentId,
}: {
  conversationId?: string;
  initialDocumentId?: string;
}) {
  const router = useRouter();
  const me = useMe();
  const conversations = useConversations();
  const conversation = useConversation(conversationId);
  const indexedDocuments = useDocuments("", "INDEXED");
  const ask = useAsk();
  const renameConversation = useRenameConversation();
  const deleteConversation = useDeleteConversation();

  const [draft, setDraft] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(
    initialDocumentId ? [initialDocumentId] : [],
  );
  const [scopeOpen, setScopeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = conversation.data?.messages ?? [];
  const userName = me.data?.name ?? "You";

  useEffect(() => {
    if (conversation.data) setSelectedDocIds(conversation.data.document_ids ?? []);
  }, [conversation.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pendingQuestion]);

  const handleNewChat = () => {
    setSelectedDocIds([]);
    setDraft("");
    setPendingQuestion(null);
    setHistoryOpen(false);
    if (conversationId) router.push("/app/chat");
  };

  const handleAsk = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;
    setDraft("");
    setPendingQuestion(trimmed);
    try {
      const response = await ask.mutateAsync({
        question: trimmed,
        conversation_id: conversationId,
        document_ids: selectedDocIds.length ? selectedDocIds : undefined,
      });
      setPendingQuestion(null);
      if (!conversationId) {
        router.replace(`/app/chat/${response.conversation.id}`);
      }
    } catch (error) {
      setPendingQuestion(null);
      setDraft(trimmed);
      toast.error(
        error instanceof ApiError ? error.message : "Could not get an answer. Please try again.",
      );
    }
  };

  const openRename = (target: Conversation) => {
    setRenameTarget(target);
    setRenameTitle(target.title);
  };

  const saveRename = () => {
    if (!renameTarget) return;
    const title = renameTitle.trim();
    if (!title) return;
    renameConversation.mutate(
      { id: renameTarget.id, title },
      {
        onSuccess: () => {
          toast.success("Conversation renamed");
          setRenameTarget(null);
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Could not rename conversation"),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteConversation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Conversation deleted");
        setDeleteTarget(null);
        if (deleteTarget.id === conversationId) router.push("/app/chat");
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Could not delete conversation"),
    });
  };

  const indexedCount = indexedDocuments.data?.length ?? 0;
  const scopeLabel = (() => {
    if (selectedDocIds.length === 0) return "All indexed documents";
    if (selectedDocIds.length === 1) {
      const match = indexedDocuments.data?.find((document) => document.id === selectedDocIds[0]);
      return match?.filename ?? "1 document selected";
    }
    return `${selectedDocIds.length} documents selected`;
  })();

  const renderMessagesArea = () => {
    if (conversationId && conversation.isLoading) {
      return (
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
          <div className="flex justify-end">
            <Skeleton className="h-16 w-2/3 rounded-2xl" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-28 w-3/4 rounded-2xl" />
          </div>
        </div>
      );
    }

    if (conversationId && conversation.isError) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="w-full max-w-md">
            <ErrorState
              title="Could not load this conversation"
              message={
                conversation.error instanceof ApiError && conversation.error.status === 404
                  ? "This conversation no longer exists."
                  : "The conversation could not be loaded. Check your connection and try again."
              }
              onRetry={() => void conversation.refetch()}
            />
          </div>
        </div>
      );
    }

    const empty = messages.length === 0 && !pendingQuestion;

    if (empty) {
      return (
        <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <Sparkles className="h-6 w-6" />
          </span>
          <h2 className="mt-5 max-w-md text-xl font-semibold tracking-tight text-slate-900">
            {indexedCount > 0
              ? "Ask anything about your documents"
              : "Add a document to start asking"}
          </h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            {indexedCount > 0
              ? "DocuMind retrieves the most relevant passages and answers with page-level citations you can verify."
              : "Your knowledge base is empty. Upload a PDF or TXT file and wait a few seconds for indexing."}
          </p>

          {indexedCount > 0 ? (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void handleAsk(suggestion)}
                  disabled={ask.isPending}
                  className="rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : (
            <Button asChild className="mt-6" size="sm">
              <Link href="/app/documents">
                <UploadCloud className="h-3.5 w-3.5" />
                Upload a document
              </Link>
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            userName={userName}
            onSourceClick={setActiveSource}
          />
        ))}
        {pendingQuestion ? (
          <ThinkingBubble question={pendingQuestion} userName={userName} />
        ) : null}
        <div ref={bottomRef} />
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-[540px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:h-[calc(100dvh-4rem)] lg:flex-row">
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-border lg:flex">
        <div className="border-b border-border p-3">
          <Button variant="outline" className="w-full justify-start" onClick={handleNewChat}>
            <MessageSquarePlus className="h-4 w-4" />
            New conversation
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <ConversationPanel
            conversations={conversations.data}
            loading={conversations.isLoading}
            activeId={conversationId}
            onNew={handleNewChat}
            onRename={openRename}
            onDelete={setDeleteTarget}
          />
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open conversation history"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {conversation.data?.title ?? "New conversation"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {indexedCount > 0
                  ? `${indexedCount} indexed document${indexedCount === 1 ? "" : "s"} available`
                  : "No indexed documents yet"}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setScopeOpen(true)}
            className="max-w-[52%] shrink-0"
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{scopeLabel}</span>
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{renderMessagesArea()}</div>

        <div className="border-t border-border bg-card p-3 sm:p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleAsk(draft);
            }}
            className="mx-auto w-full max-w-3xl"
          >
            <div className="relative">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void handleAsk(draft);
                  }
                }}
                placeholder="Ask a question about your documents…"
                aria-label="Your question"
                disabled={ask.isPending}
                className={cn("min-h-[52px] py-3.5 pr-14", ask.isPending && "opacity-70")}
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send question"
                disabled={!draft.trim() || ask.isPending}
                className="absolute bottom-2 right-2 h-9 w-9"
              >
                {ask.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizonal className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1 px-1 text-[11px] text-muted-foreground">
              <span className="truncate">Scoped to: {scopeLabel}</span>
              <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span>
            </div>
          </form>
        </div>
      </section>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Conversation history</DialogTitle>
            <DialogDescription>Switch between your saved conversations.</DialogDescription>
          </DialogHeader>
          <div className="flex h-[65vh] flex-col">
            <div className="border-b border-border p-3">
              <Button variant="outline" className="w-full justify-start" onClick={handleNewChat}>
                <MessageSquarePlus className="h-4 w-4" />
                New conversation
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <ConversationPanel
                conversations={conversations.data}
                loading={conversations.isLoading}
                activeId={conversationId}
                onNew={handleNewChat}
                onRename={openRename}
                onDelete={setDeleteTarget}
                onNavigate={() => setHistoryOpen(false)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ScopeDialog
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        documents={indexedDocuments.data ?? []}
        loading={indexedDocuments.isLoading}
        selected={selectedDocIds}
        onApply={setSelectedDocIds}
      />

      <SourceDialog
        source={activeSource}
        onOpenChange={(open) => {
          if (!open) setActiveSource(null);
        }}
      />

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>Give this thread a title you will recognize later.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveRename();
            }}
          >
            <Input
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
              maxLength={200}
              autoFocus
              aria-label="Conversation title"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !renameTitle.trim() ||
                  renameConversation.isPending ||
                  renameTitle.trim() === renameTarget?.title
                }
              >
                {renameConversation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this conversation?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” and all of its messages will be permanently deleted.`
            : ""
        }
        confirmLabel="Delete conversation"
        loading={deleteConversation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}