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
          <DialogTitle className="text-[15px] font-semibold uppercase tracking-[0.04em]">
            Choose documents
          </DialogTitle>
          <DialogDescription className="text-[11.5px] leading-5">
            Restrict retrieval to specific sources, or leave everything unchecked to search
            your entire knowledge base.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setDraft([])}
            className={cn(
              "flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors",
              draft.length === 0
                ? "border-neutral-950 bg-neutral-50"
                : "border-neutral-200 hover:bg-neutral-50",
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center border border-neutral-200 bg-white text-[#d91e4a]">
              <FileText className="h-4 w-4" />
            </span>
            <span className="flex-1">
              <span className="block text-[12.5px] font-semibold text-neutral-950">
                All documents
              </span>
              <span className="block text-[11px] text-neutral-500">
                Search across your entire knowledge base
              </span>
            </span>
            {draft.length === 0 ? <Check className="h-4 w-4 text-neutral-950" /> : null}
          </button>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-14" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <p className="border border-dashed border-neutral-300 px-4 py-6 text-center text-[12px] text-neutral-500">
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
                        "flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors",
                        checked
                          ? "border-neutral-950 bg-neutral-50"
                          : "border-neutral-200 hover:bg-neutral-50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center border",
                          checked
                            ? "border-neutral-950 bg-neutral-950 text-white"
                            : "border-neutral-300 bg-white",
                        )}
                      >
                        {checked ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-neutral-950">
                          {document.filename}
                        </span>
                        <span className="block text-[11px] text-neutral-500">
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