import { useState, useMemo, useCallback } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import {
  cn,
  tierNumber,
  formatNumber,
} from "@/lib/utils";
import { TierBadge } from "@/components/shared/TierBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ChevronRight,
  Check,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  Eye,
  FileCode,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import type {
  FileTransformationResponse,
  Transformation,
  ConfidenceTier,
} from "@/api/types";

/* ------------------------------------------------------------------ */
/*  Tier helpers                                                       */
/* ------------------------------------------------------------------ */

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", {
            "bg-green-500": pct >= 90,
            "bg-blue-500": pct >= 70 && pct < 90,
            "bg-orange-500": pct >= 50 && pct < 70,
            "bg-red-500": pct < 50,
          })}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
    </div>
  );
}

function ChangeTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    syntax: "bg-violet-500/10 border-violet-500/30 text-violet-400",
    api_migration: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
    type_annotation: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    refactor: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    dead_code_removal: "bg-gray-500/10 border-gray-500/30 text-gray-400",
    import_update: "bg-pink-500/10 border-pink-500/30 text-pink-400",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-xs", colors[type] ?? "text-muted-foreground")}
    >
      {type.replace(/_/g, " ")}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Line-level highlighting helpers                                    */
/* ------------------------------------------------------------------ */

type LineHighlight = {
  tier: ConfidenceTier;
  transformationId: string;
};

function buildLineMap(
  transformations: Transformation[],
): Map<number, LineHighlight> {
  const map = new Map<number, LineHighlight>();
  for (const t of transformations) {
    const start = t.line_start;
    const end = t.line_end;
    for (let i = start; i <= end; i++) {
      map.set(i, { tier: t.confidence_tier, transformationId: t.id });
    }
  }
  return map;
}

function tierLineBg(tier: ConfidenceTier): string {
  const n = tierNumber(tier);
  if (n === 1) return "bg-green-500/10";
  if (n === 2) return "bg-blue-500/10";
  if (n === 3) return "bg-orange-500/10";
  return "bg-red-500/10";
}

/* ------------------------------------------------------------------ */
/*  Code Pane component                                                */
/* ------------------------------------------------------------------ */

function CodePane({
  title,
  content,
  lineHighlights,
  activeTransformation,
  onLineClick,
}: {
  title: string;
  content: string;
  lineHighlights: Map<number, LineHighlight>;
  activeTransformation: string | null;
  onLineClick?: (transformationId: string) => void;
}) {
  const lines = content.split("\n");

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
        <FileCode className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {lines.length} lines
        </span>
      </div>
      <div className="overflow-auto flex-1">
        <pre className="text-sm font-mono leading-6">
          <code>
            {lines.map((line, i) => {
              const lineNum = i + 1;
              const highlight = lineHighlights.get(lineNum);
              const isActive =
                highlight && highlight.transformationId === activeTransformation;
              return (
                <div
                  key={lineNum}
                  className={cn(
                    "flex hover:bg-white/5 cursor-pointer",
                    highlight && tierLineBg(highlight.tier),
                    isActive && "ring-1 ring-inset ring-white/20",
                  )}
                  onClick={() =>
                    highlight && onLineClick?.(highlight.transformationId)
                  }
                >
                  <span className="w-12 shrink-0 text-right pr-4 text-muted-foreground/50 select-none">
                    {lineNum}
                  </span>
                  <span className="pr-4 whitespace-pre">{line}</span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Transformation Card                                                */
/* ------------------------------------------------------------------ */

function TransformationCard({
  transformation,
  status,
  isActive,
  onApprove,
  onReject,
  onClick,
}: {
  transformation: Transformation;
  status: "pending" | "approved" | "rejected";
  isActive: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClick: () => void;
}) {
  const t = transformation;
  return (
    <Card
      id={`transform-${t.id}`}
      className={cn(
        "cursor-pointer transition-all",
        isActive && "ring-2 ring-primary/50",
        status === "approved" && "border-green-500/50 bg-green-500/15 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.2)]",
        status === "rejected" && "border-red-500/50 bg-red-500/15 opacity-60",
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">
            #{t.id.slice(0, 8)}
          </span>
          <ChangeTypeBadge type={t.change_type} />
          <TierBadge tier={t.confidence_tier} />
          <span className="ml-auto text-xs text-muted-foreground">
            L{t.line_start}
            {t.line_end !== t.line_start && `\u2013${t.line_end}`}
          </span>
        </div>

        {/* Confidence bar */}
        <ConfidenceBar score={t.confidence_score} />

        {/* Reasoning */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t.reasoning}
        </p>

        {/* Code diff */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[#0F1117] p-3 overflow-auto">
            <p className="text-[10px] uppercase tracking-wider text-red-400/60 mb-1">
              Original
            </p>
            <pre className="text-xs font-mono text-red-300/80 whitespace-pre-wrap">
              {t.original_code}
            </pre>
          </div>
          <div className="rounded-lg bg-[#0F1117] p-3 overflow-auto">
            <p className="text-[10px] uppercase tracking-wider text-green-400/60 mb-1">
              Transformed
            </p>
            <pre className="text-xs font-mono text-green-300/80 whitespace-pre-wrap">
              {t.transformed_code}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={status === "approved" ? "default" : "outline"}
            className={cn(
              "h-7 text-xs",
              status === "approved" &&
                "bg-green-600 hover:bg-green-700 text-white",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onApprove();
            }}
          >
            <Check className="size-3 mr-1" />
            {status === "approved" ? "Approved" : "Approve"}
          </Button>
          <Button
            size="sm"
            variant={status === "rejected" ? "destructive" : "outline"}
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
          >
            <X className="size-3 mr-1" />
            {status === "rejected" ? "Rejected" : "Reject"}
          </Button>
          {t.requires_test && (
            <Badge
              variant="outline"
              className="ml-auto text-[10px] text-amber-400 border-amber-500/30"
            >
              Needs test
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Snapshot Tests Panel                                                */
/* ------------------------------------------------------------------ */

function SnapshotTestsPanel({
  tests,
  filePath,
}: {
  tests: FileTransformationResponse["snapshot_tests"];
  filePath: string;
}) {
  const [open, setOpen] = useState(false);
  if (tests.length === 0) return null;

  const downloadTests = () => {
    const combined = tests.map((t) => t.test_code).join("\n\n\n");
    const baseName = filePath.replace(/\.py$/, "");
    const blob = new Blob([combined], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test_${baseName}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAllTests = () => {
    const combined = tests.map((t) => t.test_code).join("\n\n\n");
    navigator.clipboard.writeText(combined);
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="size-4" />
            Snapshot Tests ({tests.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {open && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyAllTests();
                  }}
                >
                  Copy All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadTests();
                  }}
                >
                  Download .py
                </Button>
              </>
            )}
            {open ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 pt-0">
          {tests.map((test, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{test.test_name}</span>
                <span className="text-xs text-muted-foreground">
                  covers: {test.covers_functions.join(", ")}
                </span>
              </div>
              <pre className="rounded-lg bg-[#0F1117] p-4 text-xs font-mono text-muted-foreground overflow-auto max-h-64">
                {test.test_code}
              </pre>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function TransformationPage() {
  const params = useParams();
  const id = params.id!;
  // In React Router v7, the splat param captures everything after /transform/
  const filePath = params["*"] ?? "";

  // CRITICAL 3: Guard against empty filePath
  if (!filePath) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <AlertCircle className="size-8" />
          <p className="text-sm">No file selected for transformation.</p>
          <Link to={`/projects/${id}`}>
            <Button variant="outline">Back to Project</Button>
          </Link>
        </div>
      </div>
    );
  }

  const [activeTransformation, setActiveTransformation] = useState<
    string | null
  >(null);
  const [decisions, setDecisions] = useState<
    Record<string, "approved" | "rejected">
  >({});
  const [viewMode, setViewMode] = useState<"split" | "diff">("split");
  const queryClient = useQueryClient();

  // Load cached transformation results (if file was already transformed)
  const { data: cachedTransformData } = useQuery({
    queryKey: ["transformations", id, filePath],
    queryFn: () => api.getTransformations(id, filePath),
    enabled: !!filePath,
    retry: false,
  });

  // CRITICAL 2: Use useMutation for the POST transform endpoint
  const transformMutation = useMutation({
    mutationFn: () => api.transformFile(id, filePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["transformations", id, filePath] });
      queryClient.invalidateQueries({ queryKey: ["file-content", id, filePath, "migrated"] });
      queryClient.invalidateQueries({ queryKey: ["file-diff", id, filePath] });
    },
  });

  // Fetch original content immediately
  const { data: originalData, isLoading: isOriginalLoading } = useQuery({
    queryKey: ["file-content", id, filePath, "original"],
    queryFn: () => api.getFileContent(id, filePath, "original"),
    enabled: !!filePath,
  });

  // Fetch migrated content: try immediately (file may already be migrated)
  // and also refetch after a new transform succeeds
  const { data: migratedData } = useQuery({
    queryKey: ["file-content", id, filePath, "migrated"],
    queryFn: () => api.getFileContent(id, filePath, "migrated"),
    enabled: !!filePath,
    retry: false,
  });

  // Fetch unified diff: try immediately and also refetch after transform
  const { data: diffData } = useQuery({
    queryKey: ["file-diff", id, filePath],
    queryFn: () => api.getFileDiff(id, filePath),
    enabled: !!filePath,
    retry: false,
  });

  // Use mutation result if available, otherwise fall back to cached data
  const transformData = transformMutation.data ?? cachedTransformData;
  const transformations = transformData?.transformations ?? [];

  // Build line highlights
  const originalHighlights = useMemo(
    () => buildLineMap(transformations),
    [transformations],
  );
  const transformedHighlights = useMemo(
    () => buildLineMap(transformations),
    [transformations],
  );

  // Tier counts
  const tierCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const t of transformations) {
      const n = tierNumber(t.confidence_tier) as 1 | 2 | 3 | 4;
      if (n >= 1 && n <= 4) counts[n]++;
    }
    return counts;
  }, [transformations]);

  // Decision helpers
  const setDecision = useCallback(
    (transformId: string, decision: "approved" | "rejected") => {
      setDecisions((prev) => {
        if (prev[transformId] === decision) {
          const next = { ...prev };
          delete next[transformId];
          return next;
        }
        return { ...prev, [transformId]: decision };
      });
    },
    [],
  );

  const batchApproveTier1 = useCallback(() => {
    const t1Ids = transformations
      .filter((t) => tierNumber(t.confidence_tier) === 1)
      .map((t) => t.id);
    setDecisions((prev) => {
      const next = { ...prev };
      for (const tId of t1Ids) {
        next[tId] = "approved";
      }
      return next;
    });
  }, [transformations]);

  const batchApproveAll = useCallback(() => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const t of transformations) {
        next[t.id] = "approved";
      }
      return next;
    });
  }, [transformations]);

  const scrollToCard = useCallback((transformId: string) => {
    setActiveTransformation(transformId);
    const el = document.getElementById(`transform-${transformId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // CRITICAL 5: Show loader while original content is loading
  if (isOriginalLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading file content...
          </p>
        </div>
      </div>
    );
  }

  const originalContent = originalData?.content ?? "";
  const migratedContent = migratedData?.content ?? originalContent;
  const lineDelta = transformData
    ? transformData.transformed_lines - transformData.original_lines
    : 0;

  const approvedCount = Object.values(decisions).filter(
    (d) => d === "approved",
  ).length;
  const rejectedCount = Object.values(decisions).filter(
    (d) => d === "rejected",
  ).length;

  return (
    <div className="p-6 space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link
              to={`/projects/${id}`}
              className="hover:text-foreground transition-colors"
            >
              Project
            </Link>
            <ChevronRight className="size-3" />
            <Link
              to={`/projects/${id}/dashboard`}
              className="hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-foreground font-medium font-mono text-xs">
              {filePath}
            </span>
          </nav>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Transformation View
            </h1>
            {transformData && (
              <>
                <TierBadge tier={transformData.overall_tier} />
                <ConfidenceBar score={transformData.overall_confidence} />
              </>
            )}
          </div>
        </div>

        {/* Batch action buttons - only show when transform data exists */}
        {transformData && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={viewMode === "split" ? "default" : "outline"}
              onClick={() => setViewMode("split")}
            >
              Split View
            </Button>
            <Button
              size="sm"
              variant={viewMode === "diff" ? "default" : "outline"}
              onClick={() => setViewMode("diff")}
              disabled={!diffData}
            >
              Unified Diff
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <Button
              size="sm"
              variant="outline"
              className="text-green-400 border-green-500/30 hover:bg-green-500/10"
              onClick={batchApproveTier1}
            >
              <Zap className="size-3 mr-1" />
              Batch Approve T1
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={batchApproveAll}
            >
              <Check className="size-3 mr-1" />
              Approve All
            </Button>
          </div>
        )}
      </div>

      {/* ---- Transform Button (shown before transformation) ---- */}
      {!transformData && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8">
          {transformMutation.isPending ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Transforming file...
              </p>
            </div>
          ) : transformMutation.isError ? (
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="size-8 text-red-400" />
              <p className="text-sm text-red-400">
                Transform failed:{" "}
                {transformMutation.error instanceof Error
                  ? transformMutation.error.message
                  : "Unknown error"}
              </p>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => transformMutation.mutate()}
              >
                <Zap className="size-4 mr-2" />
                Retry Transform
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Click Transform to begin analyzing and transforming this file.
              </p>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => transformMutation.mutate()}
              >
                <Zap className="size-4 mr-2" />
                Transform File
              </Button>
            </>
          )}
        </div>
      )}

      {/* ---- Summary Bar (only after transform) ---- */}
      {transformData && (
        <div className="flex items-center gap-4 flex-wrap rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green-400" />
            <span className="text-sm">
              T1:{" "}
              <span className="font-semibold text-green-400">
                {tierCounts[1]}
              </span>{" "}
              auto
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-400" />
            <span className="text-sm">
              T2:{" "}
              <span className="font-semibold text-blue-400">
                {tierCounts[2]}
              </span>{" "}
              spot
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-orange-400" />
            <span className="text-sm">
              T3:{" "}
              <span className="font-semibold text-orange-400">
                {tierCounts[3]}
              </span>{" "}
              review
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-400" />
            <span className="text-sm">
              T4:{" "}
              <span className="font-semibold text-red-400">
                {tierCounts[4]}
              </span>{" "}
              manual
            </span>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm text-muted-foreground">
            {formatNumber(transformData.original_lines)} lines
            <ArrowRight className="inline size-3 mx-1" />
            {formatNumber(transformData.transformed_lines)} lines
            <span
              className={cn("ml-1 font-mono text-xs", {
                "text-green-400": lineDelta < 0,
                "text-red-400": lineDelta > 0,
                "text-muted-foreground": lineDelta === 0,
              })}
            >
              ({lineDelta >= 0 ? "+" : ""}
              {lineDelta})
            </span>
          </span>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm text-muted-foreground">
            <span className="text-green-400 font-semibold">{approvedCount}</span>{" "}
            approved,{" "}
            <span className="text-red-400 font-semibold">{rejectedCount}</span>{" "}
            rejected
          </span>
        </div>
      )}

      {/* ---- Code View (Split or Unified Diff) ---- */}
      {viewMode === "diff" && diffData ? (
        <div className="rounded-xl border border-border overflow-hidden bg-[#0F1117]">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
            <FileCode className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Unified Diff
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {diffData.transformations_applied} transformation{diffData.transformations_applied !== 1 && "s"} applied
            </span>
          </div>
          <div className="overflow-auto max-h-[600px] min-h-[400px] p-4">
            <pre className="text-sm font-mono leading-6 whitespace-pre">
              {diffData.diff}
            </pre>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-[#0F1117]">
          <div className="flex min-h-[400px] max-h-[600px]">
            <CodePane
              title="Original"
              content={originalContent}
              lineHighlights={originalHighlights}
              activeTransformation={activeTransformation}
              onLineClick={scrollToCard}
            />
            <div className="w-px bg-border" />
            <CodePane
              title="Transformed"
              content={migratedContent}
              lineHighlights={transformedHighlights}
              activeTransformation={activeTransformation}
              onLineClick={scrollToCard}
            />
          </div>
        </div>
      )}

      {/* ---- All-approved banner ---- */}
      {transformations.length > 0 && approvedCount === transformations.length && (
        <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <CheckCircle2 className="size-5 text-green-400 shrink-0" />
          <span className="text-sm font-medium text-green-400">
            All {approvedCount} transformations approved — migrated file is ready.
          </span>
        </div>
      )}

      {/* ---- Transformation List (only after transform) ---- */}
      {transformData && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Transformations ({transformations.length})
            {approvedCount > 0 && (
              <span className="ml-2 text-sm font-normal text-green-400">
                {approvedCount}/{transformations.length} approved
              </span>
            )}
          </h2>
          <div className="grid gap-3">
            {transformations.map((t) => (
              <TransformationCard
                key={t.id}
                transformation={t}
                status={decisions[t.id] ?? "pending"}
                isActive={activeTransformation === t.id}
                onApprove={() => setDecision(t.id, "approved")}
                onReject={() => setDecision(t.id, "rejected")}
                onClick={() => setActiveTransformation(t.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---- Snapshot Tests ---- */}
      {transformData && (
        <SnapshotTestsPanel tests={transformData.snapshot_tests} filePath={filePath} />
      )}
    </div>
  );
}
