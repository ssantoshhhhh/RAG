"use client";

import {
  Download,
  ExternalLink,
  FileText,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useDeleteDocument, useDocuments, useRetryDocument } from "@/lib/queries";
import type { DocumentItem, DocumentStatus } from "@/lib/types";
import { formatDate, formatFileSize } from "@/lib/utils";

const STATUS_OPTIONS: Array<{ value: "" | DocumentStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "INDEXED", label: "Indexed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "INDEXING", label: "Indexing" },
  { value: "UPLOADED", label: "Queued" },
  { value: "FAILED", label: "Failed" },
];

function isStatus(value: string): value is DocumentStatus {
  return ["UPLOADED", "PROCESSING", "INDEXING", "INDEXED", "FAILED"].includes(value);
}

function DocumentRow({
  document,
  onRetry,
  onDelete,
  retrying,
}: {
  document: DocumentItem;
  onRetry: (document: DocumentItem) => void;
  onDelete: (document: DocumentItem) => void;
  retrying: boolean;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/70 sm:px-5">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <FileText className="h-4.5 w-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/app/documents/${document.id}`}
            className="truncate text-sm font-medium text-slate-900 hover:text-indigo-700 hover:underline"
          >
            {document.filename}
          </Link>
          {document.source !== "upload" ? (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {document.source}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatFileSize(document.file_size)} · {document.page_count} page
          {document.page_count === 1 ? "" : "s"} · {document.chunk_count} chunk
          {document.chunk_count === 1 ? "" : "s"} · {formatDate(document.created_at)}
        </p>
        {document.status === "FAILED" && document.failure_message ? (
          <p className="mt-1 line-clamp-2 text-xs text-red-600">{document.failure_message}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <StatusBadge status={document.status} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${document.filename}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href={`/app/documents/${document.id}`}>
                <ExternalLink />
                Open details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/api/v1/documents/${document.id}/file`} target="_blank" rel="noreferrer">
                <Download />
                Download original
              </a>
            </DropdownMenuItem>
            {document.status === "FAILED" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={retrying} onSelect={() => onRetry(document)}>
                  <RefreshCw className={retrying ? "animate-spin" : undefined} />
                  Retry processing
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => onDelete(document)}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

export function DocumentsView({ initialStatus }: { initialStatus: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | DocumentStatus>(
    isStatus(initialStatus) ? initialStatus : "",
  );
  const deferredSearch = useDeferredValue(search);
  const documents = useDocuments(deferredSearch, status);
  const retryDocument = useRetryDocument();
  const deleteDocument = useDeleteDocument();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);

  const filtered = Boolean(search.trim() || status);
  const summary = useMemo(
    () => ({
      indexed: documents.data?.filter((document) => document.status === "INDEXED").length ?? 0,
      total: documents.data?.length ?? 0,
    }),
    [documents.data],
  );

  const handleRetry = (document: DocumentItem) => {
    retryDocument.mutate(document.id, {
      onSuccess: () =>
        toast.success(`Re-processing ${document.filename}`, {
          description: "This usually takes a few seconds.",
        }),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Could not retry document"),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteDocument.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`Deleted ${deleteTarget.filename}`);
        setDeleteTarget(null);
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : "Could not delete document");
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description={
          documents.data
            ? `${summary.total} document${summary.total === 1 ? "" : "s"} · ${summary.indexed} indexed`
            : "Upload PDF and text files to build your knowledge base."
        }
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <UploadCloud className="h-4 w-4" />
            Upload documents
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by filename…"
            className="pl-9"
            aria-label="Search documents"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "" | DocumentStatus)}
          aria-label="Filter by status"
          className="h-10 rounded-xl border border-input bg-card px-3.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {documents.isError ? (
        <ErrorState
          title="Could not load documents"
          message={
            documents.error instanceof ApiError
              ? documents.error.message
              : "Check that the backend is running and try again."
          }
          onRetry={() => void documents.refetch()}
        />
      ) : documents.isLoading ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex items-center gap-3 border-b border-border p-4 last:border-0">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : (documents.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={FileText}
          title={filtered ? "No documents match" : "Your knowledge base is empty"}
          description={
            filtered
              ? "Try a different search term or status filter."
              : "Upload your first PDF or TXT file. DocuMind will extract, chunk, and embed it automatically."
          }
          action={
            filtered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <UploadCloud className="h-3.5 w-3.5" />
                Upload documents
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {documents.data?.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                onRetry={handleRetry}
                onDelete={setDeleteTarget}
                retrying={retryDocument.isPending && retryDocument.variables === document.id}
              />
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border bg-slate-50/60 px-5 py-2.5 text-xs text-muted-foreground">
            <span>
              Showing {documents.data?.length ?? 0} document
              {(documents.data?.length ?? 0) === 1 ? "" : "s"}
            </span>
            {documents.data?.some((document) => document.status === "PROCESSING") ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Processing documents…
              </span>
            ) : null}
          </div>
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this document?"
        description={
          deleteTarget
            ? `“${deleteTarget.filename}” and its ${deleteTarget.chunk_count} indexed chunks will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete document"
        loading={deleteDocument.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}