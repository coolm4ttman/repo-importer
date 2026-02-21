import { Badge } from "@/components/ui/badge";
import { cn, riskBg } from "@/lib/utils";
import type { RiskLevel } from "@/api/types";

const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
  critical: "Critical",
};

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("border font-medium", riskBg(level), className)}
    >
      {RISK_LABELS[level]}
    </Badge>
  );
}
