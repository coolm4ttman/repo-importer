import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function tierNumber(tier: string): number {
  const map: Record<string, number> = {
    tier_1_auto_apply: 1,
    tier_2_spot_check: 2,
    tier_3_review_required: 3,
    tier_4_manual_only: 4,
  };
  return map[tier] ?? 0;
}

export function tierLabel(tier: string): string {
  const map: Record<string, string> = {
    tier_1_auto_apply: "Auto Apply",
    tier_2_spot_check: "Spot Check",
    tier_3_review_required: "Review Required",
    tier_4_manual_only: "Manual Only",
  };
  return map[tier] ?? tier;
}

export function tierColor(tier: string): string {
  const map: Record<string, string> = {
    tier_1_auto_apply: "text-green-400",
    tier_2_spot_check: "text-blue-400",
    tier_3_review_required: "text-orange-400",
    tier_4_manual_only: "text-red-400",
  };
  return map[tier] ?? "text-muted-foreground";
}

export function tierBg(tier: string): string {
  const map: Record<string, string> = {
    tier_1_auto_apply: "bg-green-500/10 border-green-500/30 text-green-400",
    tier_2_spot_check: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    tier_3_review_required: "bg-orange-500/10 border-orange-500/30 text-orange-400",
    tier_4_manual_only: "bg-red-500/10 border-red-500/30 text-red-400",
  };
  return map[tier] ?? "";
}

export function riskColor(level: string): string {
  const map: Record<string, string> = {
    low: "text-emerald-400",
    medium: "text-amber-400",
    high: "text-red-400",
    critical: "text-red-500",
  };
  return map[level] ?? "text-muted-foreground";
}

export function riskBg(level: string): string {
  const map: Record<string, string> = {
    low: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    medium: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    high: "bg-red-500/10 border-red-500/30 text-red-400",
    critical: "bg-red-600/15 border-red-600/30 text-red-500",
  };
  return map[level] ?? "";
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "text-gray-400",
    analyzing: "text-blue-400",
    ready: "text-green-400",
    in_progress: "text-amber-400",
    completed: "text-emerald-400",
    failed: "text-red-400",
  };
  return map[status] ?? "text-muted-foreground";
}

export function statusBg(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-gray-500/10 text-gray-400",
    analyzing: "bg-blue-500/10 text-blue-400",
    ready: "bg-green-500/10 text-green-400",
    in_progress: "bg-amber-500/10 text-amber-400",
    completed: "bg-emerald-500/10 text-emerald-400",
    failed: "bg-red-500/10 text-red-400",
  };
  return map[status] ?? "";
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}
