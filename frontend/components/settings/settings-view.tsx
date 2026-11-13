"use client";

import {
  ArrowRight,
  CheckCircle2,
  Database,
  Layers,
  LogOut,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealth, useLogout, useMe, useStats } from "@/lib/queries";
import { cn, formatDate, initials } from "@/lib/utils";

function StatusRow({
  label,
  description,
  ok,
  pending,
}: {
  label: string;
  description: string;
  ok: boolean | undefined;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {pending || ok === undefined ? (
        <Skeleton className="h-5 w-16 rounded-full" />
      ) : (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
            ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
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
      <PageHeader
        title="Settings"
        description="Your account, workspace health, and session controls."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>The profile tied to this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {me.isLoading ? (
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {initials(me.data?.name ?? "DocuMind")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{me.data?.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{me.data?.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Member since {formatDate(me.data?.created_at)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>What DocuMind currently knows about your files.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <Link
                href="/app/documents"
                className="rounded-xl border border-border p-3 transition-colors hover:bg-slate-50"
              >
                <Layers className="h-4 w-4 text-indigo-500" />
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {stats.data?.chunk_count ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">Chunks</p>
              </Link>
              <Link
                href="/app/documents"
                className="rounded-xl border border-border p-3 transition-colors hover:bg-slate-50"
              >
                <Database className="h-4 w-4 text-sky-500" />
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {stats.data?.document_count ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </Link>
              <Link
                href="/app/chat"
                className="rounded-xl border border-border p-3 transition-colors hover:bg-slate-50"
              >
                <MessageSquareText className="h-4 w-4 text-violet-500" />
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {stats.data?.conversation_count ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">Conversations</p>
              </Link>
            </div>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2" asChild>
              <Link href="/app/documents">
                Manage documents
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System status</CardTitle>
            <CardDescription>Live checks against the backend services.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <StatusRow
              label="API & database"
              description={health.data?.database === "ok" ? "PostgreSQL/SQLite connected" : "Checking connection"}
              ok={health.data ? health.data.database === "ok" : undefined}
              pending={health.isLoading}
            />
            <StatusRow
              label="Vector store"
              description="ChromaDB collection for document embeddings"
              ok={health.data ? health.data.vector_store === "ok" : undefined}
              pending={health.isLoading}
            />
            <StatusRow
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
              <p className="pt-3 text-xs text-red-600">
                The backend did not respond to the health check.
              </p>
            ) : health.data ? (
              <p className="pt-3 text-xs text-muted-foreground">
                DocuMind v{health.data.version} · Last checked{" "}
                {new Date(health.data.timestamp).toLocaleTimeString()}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>You are signed in with a secure HttpOnly cookie.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-slate-50/60 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Access tokens are short-lived and refreshed automatically. Signing out clears
                your session cookies from this browser.
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout} disabled={logout.isPending}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            How answers are produced
          </CardTitle>
          <CardDescription>Transparency about what leaves your machine.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm leading-relaxed text-muted-foreground sm:grid-cols-3">
            <div className="space-y-1">
              <p className="font-medium text-slate-900">1. Retrieve</p>
              <p>
                Your question is embedded locally and compared against chunk vectors stored in
                ChromaDB to find the closest passages.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-900">2. Ground</p>
<p>
                  Only the top matching excerpts, with file names and page numbers,
                  are sent to{" "}
                  {health.data?.llm_provider === "ollama"
                    ? "Ollama"
                    : health.data?.llm_provider === "gemini"
                      ? "Gemini"
                      : "the AI provider"}{" "}
                  as context for the answer.
                </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-900">3. Cite</p>
              <p>
                The answer comes back with citations. If the excerpts are not relevant enough,
                DocuMind says so instead of guessing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}