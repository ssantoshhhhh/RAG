"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ApiError, uploadDocumentFile } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { cn, formatFileSize } from "@/lib/utils";
import { validateFiles } from "@/lib/validation";

const MAX_FILES = 10;

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
}

export function UploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const client = useQueryClient();

  const addFiles = (incoming: File[]) => {
    const { accepted, errors } = validateFiles(incoming);
    for (const error of errors) toast.error(error);

    if (!accepted.length) return;
    setItems((current) => {
      const room = MAX_FILES - current.length;
      if (room <= 0) {
        toast.error(`You can upload up to ${MAX_FILES} files at a time`);
        return current;
      }
      const next = accepted.slice(0, room).map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: "idle" as const,
      }));
      if (accepted.length > room) {
        toast.error(`Only ${room} more file${room === 1 ? "" : "s"} could be added`);
      }
      return [...current, ...next];
    });
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const handleUpload = async () => {
    const pending = items.filter((item) => item.status === "idle" || item.status === "error");
    if (!pending.length) return;
    setUploading(true);
    let succeeded = 0;
    let failed = 0;

    for (const item of pending) {
      updateItem(item.id, { status: "uploading", progress: 0, error: undefined });
      try {
        await uploadDocumentFile(item.file, (percent) => {
          updateItem(item.id, { progress: percent });
        });
        updateItem(item.id, { status: "done", progress: 100 });
        succeeded += 1;
      } catch (error) {
        updateItem(item.id, {
          status: "error",
          error: error instanceof ApiError ? error.message : "Upload failed",
        });
        failed += 1;
      }
    }

    setUploading(false);
    void client.invalidateQueries({ queryKey: ["documents"] });
    void client.invalidateQueries({ queryKey: queryKeys.stats });

    if (succeeded > 0) {
      toast.success(
        `${succeeded} file${succeeded === 1 ? "" : "s"} uploaded — processing now`,
      );
    }
    if (failed === 0) {
      setItems([]);
      onOpenChange(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && uploading) return;
    if (!next) setItems([]);
    onOpenChange(next);
  };

  const hasPending = items.some((item) => item.status === "idle" || item.status === "error");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload documents</DialogTitle>
          <DialogDescription>
            Add PDF or TXT files (max 10 MB each, up to {MAX_FILES} at once). Files are
            indexed automatically.
          </DialogDescription>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!uploading) addFiles(Array.from(event.dataTransfer.files));
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors",
            dragging
              ? "border-indigo-400 bg-indigo-50/70"
              : "border-border bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/40",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-border">
            <UploadCloud className="h-5 w-5" />
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-slate-900">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">PDF and TXT · 10 MB per file</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </div>

        {items.length > 0 ? (
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(item.file.size)}
                      {item.error ? ` · ${item.error}` : ""}
                    </p>
                  </div>
                  {item.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : item.status === "uploading" ? (
                    <span className="text-xs font-medium text-indigo-600">{item.progress}%</span>
                  ) : item.status === "error" ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  ) : (
                    <button
                      type="button"
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => removeItem(item.id)}
                      className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {item.status === "uploading" ? (
                  <Progress value={item.progress} className="mt-2 h-1" />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleUpload()} disabled={!hasPending}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}