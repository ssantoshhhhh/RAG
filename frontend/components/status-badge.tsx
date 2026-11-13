import { AlertCircle, CheckCircle2, Clock3, Loader2, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/lib/types";
import { statusLabel } from "@/lib/utils";

const VARIANTS: Record<
  DocumentStatus,
  { variant: "success" | "warning" | "info" | "secondary" | "destructive"; icon: React.ReactNode }
> = {
  UPLOADED: { variant: "secondary", icon: <Clock3 className="h-3 w-3" /> },
  PROCESSING: { variant: "info", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  INDEXING: { variant: "warning", icon: <UploadCloud className="h-3 w-3" /> },
  INDEXED: { variant: "success", icon: <CheckCircle2 className="h-3 w-3" /> },
  FAILED: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const config = VARIANTS[status] ?? VARIANTS.UPLOADED;
  return (
    <Badge variant={config.variant} className="capitalize">
      {config.icon}
      {statusLabel(status)}
    </Badge>
  );
}