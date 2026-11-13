"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  Database,
  Layers,
  LogOut,
  MessageSquareText,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { panel } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealth, useLogout, useMe, useStats } from "@/lib/queries";
import { cn, formatDate, initials } from "@/lib/utils";

function CardHeader({
  title,
  description,
  right,
}: {
  title: string;
  description: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-neutral-950">{title}</h2>
        <p className="mt-0.5 text-[11.5px] leading-5 text-neutral-500">{description}</p>
      </div>
      {right ? (
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-400">
          {right}
        </span>
      ) : null}
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  description,
  ok,
  pending,
}: {
  icon: typeof Server;
  label: string;
  description: string;
  ok: boolean | undefined;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-3 last:border-b-0">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-neutral-950">{label}</p>
          <p className="mt-0.5 text-[11px] leading-5 text-neutral-500">{description}</p>
        </div>
      </div>
      {pending || ok === undefined ? (
        <Skeleton className="h-6 w-24 shrink-0" />
      ) : (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em]",
            ok
              ? "border-neutral-300 text-neutral-700"
              : "border-[#d91e4a]/40 bg-[#fff1f4] text-[#a31136]",
          )}
        >
          {ok ? (
            <Check className="h-3 w-3 text-emerald-600" />
          ) : (
            <XCircle className="h-3 w-3 text-[#d91e4a]" />
          )}
          {ok ? "Operational" : "Unavailable"}
        </span>
      )}
    </div>
  );
}

export function SettingsView() {
  const router = useRouter();
  const me = useMe();
  const stats = useStats();
  const health = useHealth();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        router.replace("/login");
        router.refresh();
        toast.success("Signed out");
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[#d91e4a]">
          <span className="h-1.5 w-1.5 bg-[#d91e4a]" />
          Preferences & System
        </p>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950 sm:text-[30px]">
          Settings
        </h1>
        <p className="mt-1 text-[13px] text-neutral-500">
          Your account, workspace health, and session controls.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={panel}>
          <CardHeader
            title="Account"
            description="The profile tied to this workspace."
            right={`ID: #${me.data?.id.slice(-5).toUpperCase() ?? "-----"}`}
          />
          <div className="px-5 py-5">
            {me.isLoading ? (
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-neutral-950 font-mono text-sm font-semibold text-white">
                  {initials(me.data?.name ?? "DocuMind")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-neutral-950">
                    {me.data?.name}
                  </p>
                  <p className="truncate text-[12px] text-neutral-500">{me.data?.email}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-neutral-400">
                    <CalendarDays className="h-3 w-3" />
                    Member since {formatDate(me.data?.created_at)}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
              Primary Workspace Owner
            </span>
            <span className="h-2.5 w-2.5 bg-neutral-950" />
          </div>
        </div>

        <div className={panel}>
          <CardHeader
            title="Workspace"
            description="What DocuMind currently knows about your files."
            right="RAG Index"
          />
          <div className="px-5 py-5">
            <div className="grid grid-cols-3 gap-2.5">
              <Link
                href="/app/documents"
                className="border border-neutral-200 p-3 transition-colors hover:bg-neutral-50"
              >
                <div className="flex items-center justify-between">
                  <Layers className="h-4 w-4 text-[#d91e4a]" />
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-neutral-400">
                    CH
                  </span>
                </div>
                <p className="mt-3 text-[24px] font-semibold leading-none text-neutral-950">
                  {stats.data?.chunk_count ?? "—"}
                </p>
                <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-neutral-500">
                  Chunks
                </p>
              </Link>
              <Link
                href="/app/documents"
                className="border border-neutral-200 p-3 transition-colors hover:bg-neutral-50"
              >
                <div className="flex items-center justify-between">
                  <Database className="h-4 w-4 text-neutral-500" />
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-neutral-400">
                    DOC
                  </span>
                </div>
                <p className="mt-3 text-[24px] font-semibold leading-none text-neutral-950">
                  {stats.data?.document_count ?? "—"}
                </p>
                <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-neutral-500">
                  Documents
                </p>
              </Link>
              <Link
                href="/app/chat"
                className="border border-neutral-200 p-3 transition-colors hover:bg-neutral-50"
              >
                <div className="flex items-center justify-between">
                  <MessageSquareText className="h-4 w-4 text-neutral-500" />
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-neutral-400">
                    CV
                  </span>
                </div>
                <p className="mt-3 text-[24px] font-semibold leading-none text-neutral-950">
                  {stats.data?.conversation_count ?? "—"}
                </p>
                <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-neutral-500">
                  Conversations
                </p>
              </Link>
            </div>
            <Link
              href="/app/documents"
              className="mt-4 inline-flex items-center gap-1.5 border-b border-neutral-950 pb-0.5 text-[11px] font-medium text-neutral-950 hover:border-[#d91e4a] hover:text-[#d91e4a]"
            >
              Manage documents
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className={panel}>
          <CardHeader
            title="System status"
            description="Live checks against the backend services."
            right={
              <span className="flex items-center gap-1.5 text-[#d91e4a]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#d91e4a]" />
                Active
              </span>
            }
          />
          <div className="px-5 py-2">
            <StatusRow
              icon={Server}
              label="API & database"
              description={
                health.data?.database === "ok"
                  ? "PostgreSQL/SQLite connected"
                  : "Checking connection"
              }
              ok={health.data ? health.data.database === "ok" : undefined}
              pending={health.isLoading}
            />
            <StatusRow
              icon={Database}
              label="Vector store"
              description="ChromaDB collection for document embeddings"
              ok={health.data ? health.data.vector_store === "ok" : undefined}
              pending={health.isLoading}
            />
            <StatusRow
              icon={Layers}
              label={
                health.data?.llm_provider === "ollama"
                  ? `Ollama · ${health.data.llm_model}`
                  : "Gemini API key"
              }
              description={
                health.data?.llm_provider === "ollama"
                  ? "Local model used to generate grounded answers"
                  : "Used to generate grounded answers"
              }
              ok={health.data?.llm_available}
              pending={health.isLoading}
            />
            {health.isError ? (
              <p className="py-3 text-[11px] text-[#a31136]">
                The backend did not respond to the health check.
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-5 py-3 font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-400">
            <span>DocuMind v{health.data?.version ?? "1.0.0"}</span>
            <span>
              Last checked{" "}
              {health.data ? new Date(health.data.timestamp).toLocaleTimeString() : "—"}
            </span>
          </div>
        </div>

        <div className={panel}>
          <CardHeader
            title="Session"
            description="You are signed in with a secure HttpOnly cookie."
            right="HttpOnly"
          />
          <div className="space-y-4 px-5 py-5">
            <div className="flex items-start gap-3 border border-neutral-200 bg-[#fafafa] p-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
              <p className="text-[11.5px] leading-5 text-neutral-500">
                Access tokens are short-lived and refreshed automatically. Signing out clears
                your session cookies from this browser.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={logout.isPending}
              className="font-mono text-[10px] uppercase tracking-[0.12em]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <div className={panel}>
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-neutral-950">
              <span className="h-2 w-2 bg-[#d91e4a]" />
              How answers are produced
            </h2>
            <p className="mt-1 text-[11.5px] text-neutral-500">
              Transparency about what leaves your machine.
            </p>
          </div>
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-400">
            Architecture
          </span>
        </div>
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-3">
          <div className="border-t-2 border-neutral-950 pt-4">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#d91e4a]">
              01 Retrieve
            </p>
            <p className="mt-2 text-[11.5px] leading-6 text-neutral-500">
              Your question is embedded locally and compared against chunk vectors stored in
              ChromaDB to find the closest passages.
            </p>
          </div>
          <div className="border-t-2 border-neutral-950 pt-4">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#d91e4a]">
              02 Ground
            </p>
            <p className="mt-2 text-[11.5px] leading-6 text-neutral-500">
              Only the top matching excerpts, with file names and page numbers, are sent to{" "}
              {health.data?.llm_provider === "ollama"
                ? "Ollama"
                : health.data?.llm_provider === "gemini"
                  ? "Gemini"
                  : "the AI provider"}{" "}
              as context for the answer.
            </p>
          </div>
          <div className="border-t-2 border-neutral-950 pt-4">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#d91e4a]">
              03 Cite
            </p>
            <p className="mt-2 text-[11.5px] leading-6 text-neutral-500">
              The answer comes back with citations. If the excerpts are not relevant enough,
              DocuMind says so instead of guessing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}