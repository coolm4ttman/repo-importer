import { cn, tierBg, tierLabel, tierNumber } from "@/lib/utils";
import type { ConfidenceTier } from "@/api/types";

interface TierBadgeProps {
  tier: ConfidenceTier;
  className?: string;
}

const DOT_COLORS: Record<ConfidenceTier, string> = {
  tier_1_auto_apply: "bg-green-400",
  tier_2_spot_check: "bg-blue-400",
  tier_3_review_required: "bg-orange-400",
  tier_4_manual_only: "bg-red-400",
};

export function TierBadge({ tier, className }: TierBadgeProps) {
  const n = tierNumber(tier);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tierBg(tier),
        className,
      )}
    >
      <span
        className={cn("size-2 rounded-full", DOT_COLORS[tier])}
      />
      T{n} {tierLabel(tier)}
    </span>
  );
}
