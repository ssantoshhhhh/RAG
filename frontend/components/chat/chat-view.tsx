"use client";

import {
  ArrowRight,
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  SendHorizonal,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConversationPanel } from "@/components/chat/conversation-panel";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ScopeDialog } from "@/components/chat/scope-dialog";
import { Logo, LogoMark } from "@/components/logo";
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
        <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-neutral-950 font-mono text-[10px] font-semibold text-white">
          {initials(userName)}
        </span>
        <div className="max-w-[85%] bg-neutral-950 px-4 py-3 text-[13px] leading-6 text-white">
          <p className="whitespace-pre-wrap break-words">{question}</p>
        </div>
      </div>
      <div className="flex flex-row gap-3">
        <LogoMark className="h-8 w-8 border border-neutral-300" />
        <div className="flex items-center gap-2.5 border border-neutral-200 bg-white px-4 py-3 text-[12px] text-neutral-500">
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce bg-neutral-400 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce bg-neutral-400 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce bg-neutral-400" />
          </span>
          Searching your documents...
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
            <Skeleton className="h-16 w-2/3" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-28 w-3/4" />
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
          <Logo className="h-20 w-auto" />
          <h2 className="mt-5 max-w-md text-[22px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950">
            {indexedCount > 0
              ? "Ask anything about your documents"
              : "Add a document to start asking"}
          </h2>
          <p className="mt-2 max-w-md text-[13px] leading-6 text-neutral-500">
            {indexedCount > 0
              ? "DocuMind retrieves the most relevant passages and answers with page-level citations you can verify."
              : "Your knowledge base is empty. Upload a PDF or TXT file and wait a few seconds for indexing."}
          </p>

          {indexedCount > 0 ? (
            <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void handleAsk(suggestion)}
                  disabled={ask.isPending}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-[11.5px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-950 disabled:opacity-60"
                >
                  {suggestion}
                  <ArrowRight className="h-3 w-3 text-neutral-400" />
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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-6 sm:px-6">
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white lg:flex-row">
      <aside className="hidden w-[300px] shrink-0 flex-col border-r border-neutral-200 lg:flex">
        <div className="border-b border-neutral-200 p-3">
          <Button
            variant="outline"
            className="w-full justify-start text-[12px] font-medium"
            onClick={handleNewChat}
          >
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
        <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 lg:hidden"
              aria-label="Open conversation history"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-[13px] font-semibold text-neutral-950">
                  {conversation.data?.title ?? "New conversation"}
                </p>
                <span className="hidden shrink-0 border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-neutral-500 sm:inline">
                  {indexedCount > 0
                    ? `${indexedCount} indexed document${indexedCount === 1 ? "" : "s"} available`
                    : "No indexed documents yet"}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[10.5px] text-neutral-500 sm:hidden">
                {indexedCount > 0
                  ? `${indexedCount} indexed document${indexedCount === 1 ? "" : "s"}`
                  : "No indexed documents yet"}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setScopeOpen(true)}
            className="max-w-[52%] shrink-0 justify-between gap-2 text-[11px] font-medium sm:max-w-none"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-[#d91e4a]" />
            <span className="truncate">{scopeLabel}</span>
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{renderMessagesArea()}</div>

        <div className="border-t border-neutral-200 bg-white p-3 sm:p-4">
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
                placeholder="Ask a question about your documents..."
                aria-label="Your question"
                disabled={ask.isPending}
                className={cn(
                  "min-h-[64px] py-4 pr-14 text-[13px]",
                  ask.isPending && "opacity-70",
                )}
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
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1 px-1 font-mono text-[9px] uppercase tracking-[0.08em] text-neutral-400">
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <span className="h-1.5 w-1.5 shrink-0 bg-[#d91e4a]" />
                Scoped to: {scopeLabel}
              </span>
              <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-400">
          <span>Conversations are saved automatically.</span>
          <span className="hidden sm:inline">DocuMind v2.4 · Monoline Engine</span>
        </div>
      </section>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Conversation history</DialogTitle>
            <DialogDescription>Switch between your saved conversations.</DialogDescription>
          </DialogHeader>
          <div className="flex h-[65vh] flex-col">
            <div className="border-b border-neutral-200 p-3">
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
            <DialogDescription>
              Give this thread a title you will recognize later.
            </DialogDescription>
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