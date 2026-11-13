"use client";

import {
  ArrowRight,
  CheckCircle2,
  Circle,
  FileText,
  Layers,
  MessageSquareText,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useStats } from "@/lib/queries";
import { cn, formatRelativeTime } from "@/lib/utils";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | undefined;
  hint: string;
  icon: typeof FileText;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5 sm:p-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {value === undefined ? (
            <Skeleton className="h-8 w-14" />
          ) : (
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          )}
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function Step({
  done,
  title,
  description,
  href,
}: {
  done: boolean;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
    >
      {done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
      ) : (
        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-medium",
            done ? "text-muted-foreground line-through" : "text-slate-900",
          )}
        >
          {title}
        </span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
    </Link>
  );
}

export function DashboardView() {
  const stats = useStats();
  const me = useMe();

  const firstName = me.data?.name?.split(" ")[0] ?? "there";
  const data = stats.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Your knowledge base at a glance, and the fastest path to your next answer."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/app/chat">
                <MessageSquareText className="h-4 w-4" />
                Ask a question
              </Link>
            </Button>
            <Button asChild>
              <Link href="/app/documents">
                <UploadCloud className="h-4 w-4" />
                Upload documents
              </Link>
            </Button>
          </>
        }
      />

      {stats.isError ? (
        <ErrorState
          title="Could not load your dashboard"
          message="The backend may be unavailable. Try refreshing in a moment."
          onRetry={() => void stats.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Documents"
              value={data?.document_count}
              hint={`${data?.indexed_document_count ?? 0} indexed`}
              icon={FileText}
              tone="bg-indigo-50 text-indigo-600"
            />
            <StatCard
              label="Indexed"
              value={data?.indexed_document_count}
              hint={
                data && data.processing_document_count > 0
                  ? `${data.processing_document_count} in progress`
                  : "Ready to answer questions"
              }
              icon={CheckCircle2}
              tone="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="Knowledge chunks"
              value={data?.chunk_count}
              hint="Searchable passages"
              icon={Layers}
              tone="bg-sky-50 text-sky-600"
            />
            <StatCard
              label="Questions asked"
              value={data?.question_count}
              hint={`${data?.conversation_count ?? 0} conversations`}
              icon={MessageSquareText}
              tone="bg-violet-50 text-violet-600"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Recent uploads</CardTitle>
                  <CardDescription>The latest documents in your workspace.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/app/documents">
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {!data ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-xl" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : data.recent_documents.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-10 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900">No documents yet</p>
                      <p className="text-xs text-muted-foreground">
                        Upload a PDF or TXT file to start building your knowledge base.
                      </p>
                    </div>
                    <Button size="sm" asChild>
                      <Link href="/app/documents">
                        <UploadCloud className="h-3.5 w-3.5" />
                        Upload a document
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.recent_documents.map((document) => (
                      <li key={document.id}>
                        <Link
                          href={`/app/documents/${document.id}`}
                          className="flex items-center gap-3 py-3 transition-colors hover:bg-slate-50/70"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                            <FileText className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">
                              {document.filename}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatRelativeTime(document.created_at)} ·{" "}
                              {document.page_count} page{document.page_count === 1 ? "" : "s"}
                            </span>
                          </span>
                          <StatusBadge status={document.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Get productive</CardTitle>
                <CardDescription>Three steps to your first cited answer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <Step
                  done={Boolean(data && data.document_count > 0)}
                  title="Upload a document"
                  description="PDF or TXT, up to 10 MB each"
                  href="/app/documents"
                />
                <Step
                  done={Boolean(data && data.indexed_document_count > 0)}
                  title="Wait for indexing"
                  description="We extract, chunk, and embed automatically"
                  href="/app/documents"
                />
                <Step
                  done={Boolean(data && data.question_count > 0)}
                  title="Ask your first question"
                  description="Answers come with page-level citations"
                  href="/app/chat"
                />

                {data && data.failed_document_count > 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    {data.failed_document_count} document
                    {data.failed_document_count === 1 ? "" : "s"} failed to process.{" "}
                    <Link href="/app/documents?status=FAILED" className="font-medium underline">
                      Review them
                    </Link>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}