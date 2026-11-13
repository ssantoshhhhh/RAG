"use client";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  MessageSquareText,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState } from "@/components/error-state";
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
import { ApiError } from "@/lib/api";
import {
  useDeleteDocument,
  useDocument,
  useDocumentPreview,
  useRetryDocument,
} from "@/lib/queries";
import { cn, formatDateTime, formatFileSize } from "@/lib/utils";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 text-[12.5px] font-medium text-neutral-950">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-52" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

export function DocumentDetailView({ documentId }: { documentId: string }) {
  const router = useRouter();
  const documentQuery = useDocument(documentId);
  const document = documentQuery.data;
  const preview = useDocumentPreview(documentId, Boolean(document));
  const retryDocument = useRetryDocument();
  const deleteDocument = useDeleteDocument();

  const [tab, setTab] = useState<"text" | "original">("text");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [documentId]);

  if (documentQuery.isLoading) return <DetailSkeleton />;

  if (documentQuery.isError || !document) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/documents">
            <ArrowLeft className="h-4 w-4" />
            Back to documents
          </Link>
        </Button>
        <ErrorState
          title="Could not load this document"
          message={
            documentQuery.error instanceof ApiError
              ? documentQuery.error.message
              : "The document may have been deleted or the backend is unavailable."
          }
          onRetry={() => void documentQuery.refetch()}
        />
      </div>
    );
  }

  const pages = preview.data?.pages ?? [];
  const currentPage = pages.find((item) => item.page_number === page) ?? pages[0];
  const totalPages = preview.data?.pages.length ?? 0;

  const handleRetry = () => {
    retryDocument.mutate(document.id, {
      onSuccess: () => toast.success("Re-processing document"),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Could not retry document"),
    });
  };

  const handleDelete = () => {
    deleteDocument.mutate(document.id, {
      onSuccess: () => {
        toast.success("Document deleted");
        router.push("/app/documents");
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Could not delete document"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/app/documents">
            <ArrowLeft className="h-4 w-4" />
            Back to documents
          </Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-neutral-200 bg-neutral-50 text-neutral-500">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <h1 className="break-words text-[20px] font-semibold tracking-[-0.02em] text-neutral-950 sm:text-[24px]">
                {document.filename}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={document.status} />
                <span>Uploaded {formatDateTime(document.created_at)}</span>
                {document.source !== "upload" ? (
                  <span className="border border-neutral-200 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-500">
                    {document.source}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/v1/documents/${document.id}/file`} target="_blank" rel="noreferrer">
                <Download className="h-3.5 w-3.5" />
                Original
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/app/chat?document=${document.id}`}>
                <MessageSquareText className="h-3.5 w-3.5" />
                Chat about this
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
              <span className="text-red-600">Delete</span>
            </Button>
          </div>
        </div>
      </div>

      {document.status === "FAILED" ? (
        <div className="flex flex-col gap-3 border border-[#d91e4a]/30 bg-[#fff1f4] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[13px] font-semibold text-[#a31136]">Processing failed</p>
            <p className="text-[12px] leading-5 text-[#a31136]">
              {document.failure_message ?? "An unexpected error occurred while indexing."}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={retryDocument.isPending}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", retryDocument.isPending && "animate-spin")}
            />
            Retry
          </Button>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-5 sm:p-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
            <MetaItem label="Type" value={document.file_type.toUpperCase()} />
            <MetaItem label="Size" value={formatFileSize(document.file_size)} />
            <MetaItem
              label="Pages"
              value={String(document.page_count)}
            />
            <MetaItem
              label="Chunks"
              value={String(document.chunk_count)}
            />
            <MetaItem
              label="Processed"
              value={document.processed_at ? formatDateTime(document.processed_at) : "—"}
            />
            <MetaItem
              label="Status"
              value={
                document.status.charAt(0) + document.status.slice(1).toLowerCase()
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Document contents</CardTitle>
              <CardDescription>
                {tab === "text"
                  ? "The cleaned text that was indexed, page by page."
                  : "The original file as uploaded."}
              </CardDescription>
            </div>
            <div className="inline-flex border border-neutral-200 bg-[#fafafa] p-1">
              {(["text", "original"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-medium capitalize transition-colors",
                    tab === value
                      ? "bg-neutral-950 text-white"
                      : "text-neutral-500 hover:text-neutral-950",
                  )}
                >
                  {value === "text" ? "Extracted text" : "Original PDF"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tab === "text" ? (
            preview.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : preview.isError ? (
              <ErrorState
                title="Preview unavailable"
                message={
                  preview.error instanceof ApiError
                    ? preview.error.message
                    : "The extracted text could not be loaded."
                }
                onRetry={() => void preview.refetch()}
              />
            ) : !preview.data || totalPages === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No extracted text available.
              </p>
            ) : (
              <div className="space-y-4">
                {totalPages > 1 ? (
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <select
                        value={page}
                        onChange={(event) => setPage(Number(event.target.value))}
                        aria-label="Select page"
                        className="border border-neutral-300 bg-white px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-neutral-950"
                      >
                        {pages.map((item) => (
                          <option key={item.page_number} value={item.page_number}>
                            Page {item.page_number}
                          </option>
                        ))}
                      </select>
                      <span>of {totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}

                <div className="border border-neutral-200 bg-[#fafafa] p-4 sm:p-5">
                  <p className="mb-2 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Page {currentPage?.page_number ?? 1}
                  </p>
                  <div className="max-h-[28rem] overflow-y-auto pr-1">
                    <p className="whitespace-pre-wrap text-[12.5px] leading-6 text-neutral-600">
                      {currentPage?.text}
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : document.file_type === "pdf" ? (
            <div className="overflow-hidden border border-neutral-200 bg-neutral-100">
              <iframe
                src={`/api/v1/documents/${document.id}/file`}
                title={document.filename}
                className="h-[36rem] w-full"
              />
            </div>
          ) : (
            <div className="border border-dashed border-neutral-300 px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Text files have no visual preview — use the extracted text tab.
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <a href={`/api/v1/documents/${document.id}/file`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open original text file
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this document?"
        description={`“${document.filename}” and its ${document.chunk_count} indexed chunks will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete document"
        loading={deleteDocument.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}