import { Badge } from "@/components/ui/badge";
import { cn, statusBg } from "@/lib/utils";
import type { MigrationStatus } from "@/api/types";

const STATUS_LABELS: Record<MigrationStatus, string> = {
  pending: "Pending",
  analyzing: "Analyzing",
  ready: "Ready",
  in_progress: "In Progress",
  completed: "Completed",
  failed: "Failed",
};

interface StatusBadgeProps {
  status: MigrationStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const isAnalyzing = status === "analyzing";

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        statusBg(status),
        isAnalyzing && "animate-pulse",
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
