import { useMemo, useRef, useState } from "react";
import { api } from "@/api/client";
import { useCountUp } from "@/hooks/useCountUp";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import {
  cn,
  tierBg,
  tierLabel,
  tierNumber,
  riskBg,
  formatNumber,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  DollarSign,
  ArrowRight,
  FileCode,
  ChevronRight,
  AlertCircle,
  Send,
  Download,
} from "lucide-react";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import type {
  ConfidenceTier,
  RiskLevel,
} from "@/api/types";

/* ------------------------------------------------------------------ */
/*  Progress Ring (SVG)                                                */
/* ------------------------------------------------------------------ */

function ProgressRing({
  percentage,
  size = 120,
  strokeWidth = 10,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient
            id="progressGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{Math.round(percentage)}%</span>
        <span className="text-xs text-muted-foreground">migrated</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      {label && (
        <p className="text-xs font-medium text-muted-foreground mb-1">
          {label}
        </p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function DashboardPage() {
  const { id } = useParams();
  const dashboardRef = useRef<HTMLDivElement>(null);

  const {
    data: dashboard,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dashboard", id],
    queryFn: () => api.getDashboard(id!),
    refetchInterval: 30_000,
  });

  // Animated counters
  const animatedDeadCode = useCountUp(dashboard?.dead_code_lines ?? 0);
  const animatedCleanup = useCountUp(dashboard?.lines_after_cleanup ?? 0);
  const moneySaved = Math.round(
    ((dashboard?.dead_code_lines ?? 0) / 10) * 75,
  );
  const animatedMoney = useCountUp(moneySaved);

  // Must be called before early returns to satisfy Rules of Hooks
  const migratedFiles = useMemo(() => {
    const set = new Set<string>();
    if (dashboard?.recent_transformations) {
      for (const t of dashboard.recent_transformations) {
        set.add(t.file_path);
      }
    }
    return set;
  }, [dashboard?.recent_transformations]);

  // PDF download
  const [pdfGenerating, setPdfGenerating] = useState(false);

  async function handleDownloadPdf() {
    if (!dashboardRef.current) return;
    setPdfGenerating(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#09090b",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgRatio = canvas.width / canvas.height;
      const pageRatio = pageWidth / pageHeight;
      let imgW: number, imgH: number;
      if (imgRatio > pageRatio) {
        imgW = pageWidth;
        imgH = pageWidth / imgRatio;
      } else {
        imgH = pageHeight;
        imgW = pageHeight * imgRatio;
      }
      const x = (pageWidth - imgW) / 2;
      const y = (pageHeight - imgH) / 2;
      pdf.addImage(imgData, "PNG", x, y, imgW, imgH);
      pdf.save(`migration-dashboard-${id}.pdf`);
    } finally {
      setPdfGenerating(false);
    }
  }

  // Slack report
  const [slackStatus, setSlackStatus] = useState<
    | { type: "success"; message: string }
    | { type: "error"; message: string }
    | null
  >(null);

  const slackMutation = useMutation({
    mutationFn: () =>
      api.sendSlackReport(
        id!,
        "https://runtime.codewords.ai/webhook/pipedream/webhook/cmlw9n5ug000811h00l0bhnql/pipedream_trigger_recorder",
      ),
    onSuccess: () => {
      setSlackStatus({ type: "success", message: "Report sent!" });
      setTimeout(() => setSlackStatus(null), 3000);
    },
    onError: (err: Error) => {
      setSlackStatus({ type: "error", message: err.message });
      setTimeout(() => setSlackStatus(null), 5000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-red-400">
          <AlertCircle className="size-8" />
          <p className="text-sm">
            Failed to load dashboard:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  // Chart data
  const riskChartData = Object.entries(dashboard.risk_distribution).map(
    ([level, count]) => ({
      name: level.charAt(0).toUpperCase() + level.slice(1),
      value: count,
      level: level as RiskLevel,
    }),
  );

  const riskBarColors: Record<string, string> = {
    low: "#10B981",
    medium: "#F59E0B",
    high: "#EF4444",
    critical: "#DC2626",
  };

  const confidenceChartData = Object.entries(
    dashboard.confidence_distribution,
  ).map(([tier, count]) => ({
    name: `T${tierNumber(tier)} ${tierLabel(tier)}`,
    value: count,
    tier: tier as ConfidenceTier,
  }));

  const confidencePieColors: Record<string, string> = {
    tier_1_auto_apply: "#22C55E",
    tier_2_spot_check: "#3B82F6",
    tier_3_review_required: "#F97316",
    tier_4_manual_only: "#EF4444",
  };

  const linesReduction = dashboard.total_lines - dashboard.lines_after_cleanup;

  return (
    <div ref={dashboardRef} className="p-6 space-y-6">
      {/* ---- Breadcrumb ---- */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          to={`/projects/${id}`}
          className="hover:text-foreground transition-colors"
        >
          Project
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground font-medium">
          {dashboard.project_name}
        </span>
        <ChevronRight className="size-3" />
        <span className="text-foreground font-medium">Dashboard</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Migration Dashboard
        </h1>
        <div className="flex items-center gap-3">
          {slackStatus && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-sm font-medium",
                slackStatus.type === "success"
                  ? "text-green-400"
                  : "text-red-400",
              )}
            >
              {slackStatus.type === "success" ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              {slackStatus.message}
            </span>
          )}
          <button
            onClick={handleDownloadPdf}
            disabled={pdfGenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pdfGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="size-4" />
                Download PDF
              </>
            )}
          </button>
          <button
            onClick={() => slackMutation.mutate()}
            disabled={slackMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2DA1E0] hover:bg-[#36B7FC] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {slackMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="size-4" />
                Send Report to Slack
              </>
            )}
          </button>
        </div>
      </div>

      {/* ---- Top Metrics Row ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Progress Ring */}
        <Card className="bg-card border border-border rounded-xl p-6">
          <CardContent className="p-0 flex flex-col items-center gap-3">
            <ProgressRing percentage={dashboard.migration_percentage} />
            <div className="text-center">
              <p className="text-sm font-medium">Migration Progress</p>
              <p className="text-xs text-muted-foreground">
                {dashboard.migrated_files}/{dashboard.total_files} files
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dead Code Lines */}
        <Card className="bg-card border border-border rounded-xl p-6">
          <CardContent className="p-0 flex flex-col items-center justify-center gap-2 h-full">
            <Trash2 className="size-8 text-amber-400" />
            <span className="text-3xl font-bold text-amber-400 tabular-nums">
              {formatNumber(animatedDeadCode)}
            </span>
            <p className="text-sm text-muted-foreground text-center">
              Dead Code Lines
            </p>
          </CardContent>
        </Card>

        {/* Lines After Cleanup */}
        <Card className="bg-card border border-border rounded-xl p-6">
          <CardContent className="p-0 flex flex-col items-center justify-center gap-2 h-full">
            <FileCode className="size-8 text-emerald-400" />
            <span className="text-3xl font-bold tabular-nums">
              {formatNumber(animatedCleanup)}
            </span>
            <Badge
              variant="outline"
              className="text-xs text-green-400 border-green-500/30"
            >
              -{formatNumber(linesReduction)} lines
            </Badge>
            <p className="text-sm text-muted-foreground text-center">
              Lines After Cleanup
            </p>
          </CardContent>
        </Card>

        {/* Money Saved */}
        <Card className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-amber-400/5" />
          <CardContent className="p-0 flex flex-col items-center justify-center gap-2 h-full relative">
            <DollarSign className="size-8 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
            <span className="text-3xl font-bold text-amber-400 tabular-nums drop-shadow-[0_0_12px_rgba(251,191,36,0.3)]">
              ${formatNumber(animatedMoney)}
            </span>
            <p className="text-sm text-muted-foreground text-center">
              Estimated Savings
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              ({formatNumber(dashboard.dead_code_lines)} lines / 10) x $75
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---- Charts Row ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Distribution */}
        <Card className="bg-card border border-border rounded-xl p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={riskChartData}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 60 }}
              >
                <XAxis type="number" stroke="#525252" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#525252"
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload as Array<{ value: number; name: string; color: string }>}
                      label={label as string}
                    />
                  )}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                  {riskChartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={riskBarColors[entry.level] ?? "#6B7280"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Confidence Distribution */}
        <Card className="bg-card border border-border rounded-xl p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base">
              Confidence Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={confidenceChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {confidenceChartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        confidencePieColors[entry.tier] ?? "#6B7280"
                      }
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload as Array<{ value: number; name: string; color: string }>}
                    />
                  )}
                />
                <Legend
                  verticalAlign="bottom"
                  formatter={(value: string) => (
                    <span className="text-xs text-muted-foreground">
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ---- Bottom Row ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Migration Plan Checklist */}
        <Card className="bg-card border border-border rounded-xl p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base">Migration Plan</CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-2 max-h-80 overflow-auto">
            {dashboard.migration_plan.map((step) => {
              const isMigrated = migratedFiles.has(step.file_path);
              return (
                <div
                  key={step.order}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                    isMigrated
                      ? "bg-emerald-500/5 text-emerald-400"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="shrink-0">
                    {isMigrated ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <span className="size-4 rounded-full border border-muted-foreground/30 block" />
                    )}
                  </span>
                  <Link
                    to={`/projects/${id}/transform/${step.file_path}`}
                    className="font-mono text-xs truncate hover:underline flex-1 min-w-0"
                  >
                    {step.file_path}
                  </Link>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] shrink-0", riskBg(step.risk_level))}
                  >
                    {step.risk_level}
                  </Badge>
                  <span className="text-xs text-muted-foreground/60 shrink-0">
                    ~{step.estimated_transformations} changes
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Blockers Panel */}
        <Card className="bg-card border border-border rounded-xl p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-400" />
              Blockers ({dashboard.blockers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-2 max-h-80 overflow-auto">
            {dashboard.blockers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No blockers. Looking good!
              </p>
            ) : (
              dashboard.blockers.map((blocker, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border-l-2 border-red-500/50 bg-red-500/5 px-3 py-2"
                >
                  <AlertTriangle className="size-4 text-red-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    {blocker}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Recent Transformations Feed ---- */}
      <Card className="bg-card border border-border rounded-xl p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-base">Recent Transformations</CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-1 max-h-64 overflow-auto">
          {dashboard.recent_transformations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No transformations yet.
            </p>
          ) : (
            dashboard.recent_transformations.map((t) => {
              const n = tierNumber(t.confidence_tier);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors text-sm"
                >
                  <Link
                    to={`/projects/${id}/transform/${t.file_path}`}
                    className="font-mono text-xs text-muted-foreground hover:text-foreground truncate min-w-0 max-w-[180px]"
                  >
                    {t.file_path}
                  </Link>
                  <span className="text-xs text-muted-foreground/50">
                    L{t.line_start}
                  </span>
                  <span className="text-xs text-red-300/60 font-mono truncate max-w-[120px]">
                    {t.original_code.split("\n")[0]}
                  </span>
                  <ArrowRight className="size-3 text-muted-foreground/40 shrink-0" />
                  <span className="text-xs text-green-300/60 font-mono truncate max-w-[120px]">
                    {t.transformed_code.split("\n")[0]}
                  </span>
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center gap-1 text-[10px] font-semibold shrink-0 rounded-full px-2 py-0.5 border",
                      tierBg(t.confidence_tier),
                    )}
                  >
                    <span
                      className={cn("size-1.5 rounded-full", {
                        "bg-green-400": n === 1,
                        "bg-blue-400": n === 2,
                        "bg-orange-400": n === 3,
                        "bg-red-400": n === 4,
                      })}
                    />
                    T{n}
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
