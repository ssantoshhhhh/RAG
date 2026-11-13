"use client";

import { Check, FileText } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentItem } from "@/lib/types";
import { cn, formatFileSize } from "@/lib/utils";

export function ScopeDialog({
  open,
  onOpenChange,
  documents,
  loading,
  selected,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: DocumentItem[];
  loading: boolean;
  selected: string[];
  onApply: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);

  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  const toggle = (id: string) => {
    setDraft((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose documents</DialogTitle>
          <DialogDescription>
            Restrict retrieval to specific sources, or leave everything unchecked to search
            your entire knowledge base.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setDraft([])}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
              draft.length === 0
                ? "border-indigo-200 bg-indigo-50/70"
                : "border-border hover:bg-slate-50",
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <FileText className="h-4 w-4" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-slate-900">All documents</span>
              <span className="block text-xs text-muted-foreground">
                Search across your entire knowledge base
              </span>
            </span>
            {draft.length === 0 ? <Check className="h-4 w-4 text-indigo-600" /> : null}
          </button>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No indexed documents yet. Upload and index a document first.
            </p>
          ) : (
            <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {documents.map((document) => {
                const checked = draft.includes(document.id);
                return (
                  <li key={document.id}>
                    <button
                      type="button"
                      onClick={() => toggle(document.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                        checked
                          ? "border-indigo-200 bg-indigo-50/70"
                          : "border-border hover:bg-slate-50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          checked
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 bg-white",
                        )}
                      >
                        {checked ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {document.filename}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {document.page_count} pages · {formatFileSize(document.file_size)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply scope
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}