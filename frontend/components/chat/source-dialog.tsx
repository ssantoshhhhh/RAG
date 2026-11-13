"use client";

import { FileText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Source } from "@/lib/types";

export function SourceDialog({
  source,
  onOpenChange,
}: {
  source: Source | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(source)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <FileText className="h-4 w-4 text-indigo-600" />
            <span className="truncate">{source?.filename}</span>
          </DialogTitle>
          <DialogDescription>
            Page {source?.page_number}
            {typeof source?.similarity === "number"
              ? ` · ${Math.round(source.similarity * 100)}% match`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <blockquote className="max-h-72 overflow-y-auto rounded-xl border border-border bg-slate-50/70 p-4 text-sm leading-relaxed text-slate-700">
          {source?.excerpt}
        </blockquote>

        {source ? (
          <Button variant="outline" size="sm" asChild className="w-fit">
            <Link href={`/app/documents/${source.document_id}`}>Open document details</Link>
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}