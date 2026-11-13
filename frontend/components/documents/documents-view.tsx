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
    <li className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-neutral-50 sm:grid sm:grid-cols-[minmax(0,1fr)_150px_72px] sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-neutral-200 bg-neutral-50 font-mono text-[11px] font-semibold text-neutral-500">
          {document.filename.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/app/documents/${document.id}`}
              className="truncate text-[12.5px] font-semibold text-neutral-950 hover:text-[#d91e4a]"
            >
              {document.filename}
            </Link>
            {document.source !== "upload" ? (
              <Badge
                variant="outline"
                className="font-mono text-[9px] uppercase tracking-[0.1em]"
              >
                {document.source}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[11px] text-neutral-500">
            {formatFileSize(document.file_size)} · {document.page_count} page
            {document.page_count === 1 ? "" : "s"} · {document.chunk_count} chunk
            {document.chunk_count === 1 ? "" : "s"} · {formatDate(document.created_at)}
          </p>
          {document.status === "FAILED" && document.failure_message ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-[#a31136]">
              {document.failure_message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:block">
        <StatusBadge status={document.status} />
        <div className="sm:hidden">
          <ActionsMenu
            document={document}
            onRetry={onRetry}
            onDelete={onDelete}
            retrying={retrying}
          />
        </div>
      </div>

      <div className="hidden justify-end sm:flex">
        <ActionsMenu
          document={document}
          onRetry={onRetry}
          onDelete={onDelete}
          retrying={retrying}
        />
      </div>
    </li>
  );
}

function ActionsMenu({
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-400"
          aria-label={`Actions for ${document.filename}`}
        >
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
    <div>
      <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-[20px] font-semibold uppercase tracking-[0.02em] text-neutral-950">
              Documents
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
              / {summary.total} document{summary.total === 1 ? "" : "s"} · {summary.indexed}{" "}
              indexed
            </span>
          </div>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="h-10 justify-between gap-4 px-4 font-mono text-[10px] uppercase tracking-[0.14em]"
        >
          <span className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4" />
            Upload documents
          </span>
        </Button>
      </div>

      <div className="py-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by filename..."
              className="h-10 pl-9 text-[13px]"
              aria-label="Search documents"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-950"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "" | DocumentStatus)}
            aria-label="Filter by status"
            className="h-10 border border-neutral-300 bg-white px-3.5 text-[12px] text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-950 sm:w-[170px]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
        <div className="border border-neutral-200 bg-white">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-b border-neutral-200 p-4 last:border-0"
            >
              <Skeleton className="h-10 w-10" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16" />
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
        <div className="border border-neutral-200 bg-white">
          <div className="hidden grid-cols-[minmax(0,1fr)_150px_72px] items-center gap-4 border-b border-neutral-200 bg-[#fafafa] px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-500 sm:grid">
            <span>Document name & details</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-neutral-200">
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
          <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">
            <span>
              Showing {documents.data?.length ?? 0} document
              {(documents.data?.length ?? 0) === 1 ? "" : "s"}
            </span>
            {documents.data?.some((document) => document.status === "PROCESSING") ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Processing documents...
              </span>
            ) : (
              <span>Page 1 of 1</span>
            )}
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