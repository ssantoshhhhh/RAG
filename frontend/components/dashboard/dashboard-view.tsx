"use client";

import {
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  FileText,
  Layers,
  MessageSquare,
  MessageSquareText,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";

import { panel } from "@/components/app-ui";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useStats } from "@/lib/queries";
import { cn, formatRelativeTime } from "@/lib/utils";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | undefined;
  hint: string;
  icon: typeof FileText;
  accent?: boolean;
}) {
  return (
    <div className={cn(panel, "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
          {label}
        </p>
        <Icon className="h-4 w-4 text-neutral-400" />
      </div>
      {value === undefined ? (
        <Skeleton className="mt-4 h-8 w-14" />
      ) : (
        <p className="mt-3 text-[32px] font-semibold leading-none tracking-[-0.03em] text-neutral-950">
          {value}
        </p>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-4 text-neutral-500">
        {accent ? <span className="h-1.5 w-1.5 bg-[#d91e4a]" /> : null}
        {hint}
      </p>
    </div>
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
      className="group flex items-center gap-3 border border-neutral-200 bg-white px-3.5 py-3 transition-colors hover:bg-neutral-50"
    >
      {done ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-neutral-300" />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[12.5px] font-semibold",
            done ? "text-neutral-500" : "text-neutral-950",
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-5 text-neutral-500">
          {description}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
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
            <Button variant="outline" asChild className="text-[13px]">
              <Link href="/app/chat">
                <MessageSquareText className="h-4 w-4" />
                Ask a question
              </Link>
            </Button>
            <Button asChild className="text-[13px]">
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
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              label="Documents"
              value={data?.document_count}
              hint={`${data?.indexed_document_count ?? 0} indexed`}
              icon={FileText}
            />
            <StatCard
              label="Indexed"
              value={data?.indexed_document_count}
              hint={
                data && data.processing_document_count > 0
                  ? `${data.processing_document_count} in progress`
                  : "Ready to answer questions"
              }
              icon={Check}
              accent={Boolean(data && data.indexed_document_count > 0)}
            />
            <StatCard
              label="Knowledge chunks"
              value={data?.chunk_count}
              hint="Searchable passages"
              icon={Layers}
            />
            <StatCard
              label="Questions asked"
              value={data?.question_count}
              hint={`${data?.conversation_count ?? 0} conversations`}
              icon={MessageSquare}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className={panel}>
              <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-neutral-950">Recent uploads</h2>
                  <p className="mt-0.5 text-[11.5px] text-neutral-500">
                    The latest documents in your workspace.
                  </p>
                </div>
                <Link
                  href="/app/documents"
                  className="flex shrink-0 items-center gap-1 border-b border-neutral-950 pb-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-950 hover:border-[#d91e4a] hover:text-[#d91e4a]"
                >
                  View all
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="p-3">
                {!data ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 border border-neutral-100 px-3 py-3"
                      >
                        <Skeleton className="h-10 w-10" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                      </div>
                    ))}
                  </div>
                ) : data.recent_documents.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 border border-dashed border-neutral-300 px-4 py-10 text-center">
                    <span className="flex h-10 w-10 items-center justify-center border border-neutral-200 bg-neutral-50 text-neutral-500">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-neutral-950">No documents yet</p>
                      <p className="text-[12px] text-neutral-500">
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
                  <ul className="space-y-2">
                    {data.recent_documents.map((document) => (
                      <li key={document.id}>
                        <Link
                          href={`/app/documents/${document.id}`}
                          className="flex items-center gap-3 border border-neutral-200 px-3 py-3 transition-colors hover:bg-neutral-50"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-neutral-200 bg-neutral-50 text-neutral-500">
                            <FileText className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-semibold text-neutral-950">
                              {document.filename}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-neutral-500">
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
              </div>
            </div>

            <div className={panel}>
              <div className="border-b border-neutral-200 px-5 py-4">
                <h2 className="text-[15px] font-semibold text-neutral-950">Get productive</h2>
                <p className="mt-0.5 text-[11.5px] text-neutral-500">
                  Three steps to your first cited answer.
                </p>
              </div>
              <div className="space-y-2 p-3">
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
                  <div className="mt-3 border border-amber-300 bg-amber-50 p-3 text-[11.5px] text-amber-800">
                    {data.failed_document_count} document
                    {data.failed_document_count === 1 ? "" : "s"} failed to process.{" "}
                    <Link href="/app/documents?status=FAILED" className="font-semibold underline">
                      Review them
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}