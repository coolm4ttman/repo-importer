import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "@/api/client";
import type {
  AnalysisResponse,
  FileInfo,
  DeadCodeItem,
  DependencyNode,
  RiskAssessment,
  MigrationPlanStep,
} from "@/api/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  cn,
  formatNumber,
} from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { TierBadge } from "@/components/shared/TierBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileCode,
  AlertTriangle,
  Network,
  Shield,
  ListOrdered,
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  ArrowRight,
  Trash2,
  CheckCircle2,
  XCircle,
  Minus,
  Download,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Inline helper components                                                  */
/* -------------------------------------------------------------------------- */

const KIND_STYLES: Record<string, { label: string; color: string }> = {
  function: { label: "fn", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  class: { label: "cl", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  import: { label: "im", color: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  variable: { label: "var", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
};

function KindBadge({ kind }: { kind: string }) {
  const style = KIND_STYLES[kind] ?? {
    label: kind.slice(0, 3),
    color: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        style.color,
      )}
    >
      {style.label}
    </span>
  );
}

const RISK_LEFT_BORDER: Record<string, string> = {
  low: "border-l-emerald-500",
  medium: "border-l-amber-500",
  high: "border-l-red-500",
  critical: "border-l-red-600",
};

const RISK_DOT: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
  critical: "bg-red-600",
};

const ORDER_BG: Record<number, string> = {
  1: "bg-emerald-500/10 text-emerald-400",
  2: "bg-blue-500/10 text-blue-400",
  3: "bg-amber-500/10 text-amber-400",
  4: "bg-orange-500/10 text-orange-400",
  5: "bg-red-500/10 text-red-400",
};

function orderBg(order: number | null): string {
  if (order === null) return "bg-gray-500/10 text-gray-400";
  return ORDER_BG[order] ?? ORDER_BG[Math.min(order, 5)] ?? "bg-gray-500/10 text-gray-400";
}

/* -------------------------------------------------------------------------- */
/*  Dead Code Tab                                                             */
/* -------------------------------------------------------------------------- */

function DeadCodeTab({ items }: { items: DeadCodeItem[] }) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map = new Map<string, DeadCodeItem[]>();
    for (const item of items) {
      const existing = map.get(item.file_path);
      if (existing) {
        existing.push(item);
      } else {
        map.set(item.file_path, [item]);
      }
    }
    return map;
  }, [items]);

  const totalLines = useMemo(
    () => items.reduce((sum, i) => sum + i.lines_saved, 0),
    [items],
  );

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CheckCircle2 className="w-10 h-10 mb-3 text-emerald-500" />
        <p className="text-sm font-medium">No dead code detected</p>
        <p className="text-xs mt-1">Your codebase looks clean!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex gap-4">
        <Card className="flex-1 py-4">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatNumber(totalLines)}</p>
              <p className="text-xs text-muted-foreground">Dead code lines</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 py-4">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{items.length}</p>
              <p className="text-xs text-muted-foreground">Dead code items</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 py-4">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileCode className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{grouped.size}</p>
              <p className="text-xs text-muted-foreground">Files affected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grouped by file */}
      <div className="space-y-2">
        {Array.from(grouped.entries()).map(([filePath, fileItems]) => {
          const expanded = expandedFiles.has(filePath);
          const fileLinesSaved = fileItems.reduce((s, i) => s + i.lines_saved, 0);
          return (
            <div key={filePath} className="rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => toggleFile(filePath)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors rounded-lg"
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className="font-mono text-sm truncate flex-1">{filePath}</span>
                <Badge variant="secondary" className="text-xs">
                  {fileItems.length} items
                </Badge>
                <span className="text-xs text-red-400">-{fileLinesSaved} lines</span>
              </button>

              {expanded && (
                <div className="border-t border-border divide-y divide-border">
                  {fileItems.map((item, idx) => (
                    <div
                      key={`${item.name}-${item.line_start}-${idx}`}
                      className="flex items-center gap-3 px-4 py-2.5 pl-11 hover:bg-accent/20 transition-colors"
                    >
                      <KindBadge kind={item.kind} />
                      <span className="font-mono text-sm text-foreground">{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        L{item.line_start}-{item.line_end}
                      </span>
                      <span className="text-xs text-red-400 ml-auto">
                        -{item.lines_saved} lines
                      </span>
                      <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {item.reason}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dependencies Tab                                                          */
/* -------------------------------------------------------------------------- */

function DependenciesTab({ graph }: { graph: Record<string, DependencyNode> }) {
  const nodes = useMemo(() => {
    return Object.values(graph).sort((a, b) => {
      const oa = a.migration_order ?? Infinity;
      const ob = b.migration_order ?? Infinity;
      return oa - ob;
    });
  }, [graph]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Network className="w-10 h-10 mb-3" />
        <p className="text-sm font-medium">No dependency data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Migration Order:</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={cn("px-2 py-0.5 rounded", orderBg(n))}>
            {n}
          </span>
        ))}
        <span className={cn("px-2 py-0.5 rounded", orderBg(null))}>Unassigned</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">File</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Order</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Imports</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                Imported By
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                External Deps
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                Circular
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {nodes.map((node) => (
              <tr
                key={node.file_path}
                className="hover:bg-accent/20 transition-colors"
              >
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs">{node.file_path}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                      orderBg(node.migration_order),
                    )}
                  >
                    {node.migration_order ?? "-"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {node.imports.length === 0 ? (
                      <span className="text-xs text-muted-foreground">--</span>
                    ) : (
                      node.imports.map((imp) => (
                        <Badge key={imp} variant="secondary" className="text-[10px] font-mono">
                          {imp}
                        </Badge>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {node.imported_by.length === 0 ? (
                      <span className="text-xs text-muted-foreground">--</span>
                    ) : (
                      node.imported_by.map((imp) => (
                        <Badge key={imp} variant="secondary" className="text-[10px] font-mono">
                          {imp}
                        </Badge>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {node.external_deps.length === 0 ? (
                      <span className="text-xs text-muted-foreground">--</span>
                    ) : (
                      node.external_deps.map((dep) => (
                        <Badge key={dep} variant="outline" className="text-[10px] font-mono">
                          {dep}
                        </Badge>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {node.circular_deps.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {node.circular_deps.map((dep) => (
                        <Badge
                          key={dep}
                          variant="outline"
                          className="text-[10px] font-mono border-red-500/30 text-red-400"
                        >
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Risk Heat Map Tab                                                         */
/* -------------------------------------------------------------------------- */

function RiskHeatMapTab({ assessments }: { assessments: RiskAssessment[] }) {
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () => [...assessments].sort((a, b) => b.risk_score - a.risk_score),
    [assessments],
  );

  const toggleFactors = (filePath: string) => {
    setExpandedFactors((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  if (assessments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Shield className="w-10 h-10 mb-3" />
        <p className="text-sm font-medium">No risk assessment data available</p>
      </div>
    );
  }

  const testIcon = (coverage: string) => {
    if (coverage === "none" || coverage === "low") {
      return <XCircle className="w-4 h-4 text-red-400" />;
    }
    if (coverage === "medium" || coverage === "partial") {
      return <Minus className="w-4 h-4 text-amber-400" />;
    }
    return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">File</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
              Risk Level
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-40">
              Score
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Factors</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Tests</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
              Recommended Tier
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((item) => {
            const expanded = expandedFactors.has(item.file_path);
            return (
              <tr
                key={item.file_path}
                className={cn(
                  "border-l-4 hover:bg-accent/20 transition-colors",
                  RISK_LEFT_BORDER[item.risk_level] ?? "border-l-gray-500",
                )}
              >
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs">{item.file_path}</span>
                </td>
                <td className="px-4 py-2.5">
                  <RiskBadge level={item.risk_level} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={item.risk_score}
                      className={cn(
                        "h-2 flex-1",
                        item.risk_level === "low" && "[&>[data-slot=progress-indicator]]:bg-emerald-500",
                        item.risk_level === "medium" && "[&>[data-slot=progress-indicator]]:bg-amber-500",
                        item.risk_level === "high" && "[&>[data-slot=progress-indicator]]:bg-red-500",
                        item.risk_level === "critical" && "[&>[data-slot=progress-indicator]]:bg-red-600",
                      )}
                    />
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {item.risk_score}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleFactors(item.file_path)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    {item.factors.length} factor{item.factors.length !== 1 && "s"}
                  </button>
                  {expanded && (
                    <ul className="mt-1.5 space-y-0.5">
                      {item.factors.map((factor, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground pl-4">
                          - {factor}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">{testIcon(item.test_coverage_estimate)}</td>
                <td className="px-4 py-2.5">
                  <TierBadge tier={item.recommended_tier} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Migration Plan Tab                                                        */
/* -------------------------------------------------------------------------- */

function MigrationPlanTab({
  steps,
  projectId,
}: {
  steps: MigrationPlanStep[];
  projectId: string;
}) {
  const navigate = useNavigate();

  const sorted = useMemo(() => [...steps].sort((a, b) => a.order - b.order), [steps]);

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ListOrdered className="w-10 h-10 mb-3" />
        <p className="text-sm font-medium">No migration plan available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-6 bottom-6 w-px bg-border" />

        <div className="space-y-4">
          {sorted.map((step) => (
            <div key={step.file_path} className="relative flex gap-4">
              {/* Dot */}
              <div className="relative z-10 flex items-start pt-1">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0",
                    RISK_DOT[step.risk_level] ?? "bg-gray-500",
                  )}
                >
                  {step.order}
                </div>
              </div>

              {/* Step card */}
              <Card className="flex-1 py-4">
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium">{step.file_path}</span>
                      <RiskBadge level={step.risk_level} />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate(
                          `/projects/${projectId}/transform/${encodeURIComponent(step.file_path)}`,
                        )
                      }
                      className="gap-1.5"
                    >
                      Transform Now
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <span>
                      Est. transformations:{" "}
                      <span className="text-foreground font-medium">
                        {step.estimated_transformations}
                      </span>
                    </span>
                    {step.dependencies.length > 0 && (
                      <span>
                        Depends on:{" "}
                        {step.dependencies.map((dep) => (
                          <Badge
                            key={dep}
                            variant="secondary"
                            className="text-[10px] font-mono ml-1"
                          >
                            {dep}
                          </Badge>
                        ))}
                      </span>
                    )}
                    {step.blocking.length > 0 && (
                      <span>
                        Blocks:{" "}
                        {step.blocking.map((b) => (
                          <Badge
                            key={b}
                            variant="secondary"
                            className="text-[10px] font-mono ml-1"
                          >
                            {b}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom action */}
      <div className="flex justify-center pt-2">
        <Button
          size="lg"
          onClick={() => navigate(`/projects/${projectId}/batch`)}
          className="gap-2"
        >
          <ListOrdered className="w-4 h-4" />
          Migrate All in Order
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  File Upload Zone                                                          */
/* -------------------------------------------------------------------------- */

function FileUploadZone({
  projectId,
  onUploadComplete,
}: {
  projectId: string;
  onUploadComplete: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => api.uploadFiles(projectId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-files", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onUploadComplete();
    },
  });

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const pyFiles = Array.from(fileList).filter(
        (f) => f.name.endsWith(".py") || f.name.endsWith(".pyw"),
      );
      if (pyFiles.length === 0) return;
      uploadMutation.mutate(pyFiles);
    },
    [uploadMutation],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 transition-all cursor-pointer",
        isDragging
          ? "border-indigo-500 bg-indigo-500/5"
          : "border-border hover:border-muted-foreground/50 hover:bg-accent/20",
        uploadMutation.isPending && "pointer-events-none opacity-60",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".py,.pyw"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {uploadMutation.isPending ? (
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      ) : (
        <Upload className="w-8 h-8 text-muted-foreground" />
      )}
      <div className="text-center">
        <p className="text-sm font-medium">
          {uploadMutation.isPending
            ? "Uploading files..."
            : "Drag & drop Python files here, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Accepts .py files</p>
      </div>
      {uploadMutation.isError && (
        <p className="text-xs text-red-400 mt-1">
          Upload failed: {uploadMutation.error.message}
        </p>
      )}
      {uploadMutation.isSuccess && (
        <p className="text-xs text-emerald-400 mt-1">
          <Check className="inline w-3 h-3 mr-1" />
          {uploadMutation.data.uploaded} file{uploadMutation.data.uploaded !== 1 && "s"} uploaded
          successfully
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  File List                                                                 */
/* -------------------------------------------------------------------------- */

function FileList({
  files,
  projectId,
}: {
  files: FileInfo[];
  projectId: string;
}) {
  const navigate = useNavigate();

  if (files.length === 0) return null;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">
          {files.length} file{files.length !== 1 && "s"} uploaded
        </span>
      </div>
      <div className="divide-y divide-border">
        {files.map((file, i) => (
          <div
            key={`${file.filename}-${i}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors group"
          >
            <FileCode className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-mono text-sm truncate flex-1">{file.filename}</span>
            <span className="text-xs text-muted-foreground">{formatNumber(file.lines)} lines</span>
            <Button
              size="xs"
              variant="ghost"
              onClick={() =>
                navigate(
                  `/projects/${projectId}/transform/${encodeURIComponent(file.filename)}`,
                )
              }
              className="opacity-0 group-hover:opacity-100 transition-opacity gap-1"
            >
              Transform
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Page Component                                                       */
/* -------------------------------------------------------------------------- */

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch project details
  const projectQuery = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });

  // Fetch project files
  const filesQuery = useQuery({
    queryKey: ["project-files", id],
    queryFn: () => api.listFiles(id!),
    enabled: !!id,
  });

  // Analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: () => api.analyzeProject(id!),
    onSuccess: (data) => {
      queryClient.setQueryData(["project-analysis", id], data);
      queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
  });

  // Cached analysis result
  const analysisQuery = useQuery<AnalysisResponse>({
    queryKey: ["project-analysis", id],
    queryFn: () => api.analyzeProject(id!),
    enabled: false, // only populated via mutation
    staleTime: Infinity, // Never auto-expire from cache during session
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProject(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate("/");
    },
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleExport = async () => {
    try {
      const blob = await api.exportProject(id!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}_export.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently handle export error
    }
  };

  const project = projectQuery.data;
  const files = filesQuery.data?.files ?? [];
  const analysis = analysisQuery.data ?? (analyzeMutation.isSuccess ? analyzeMutation.data : null);

  const hasFiles = files.length > 0;
  const isAnalyzing = analyzeMutation.isPending;

  // Loading state
  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (projectQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-muted-foreground">
          Failed to load project: {projectQuery.error.message}
        </p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/*  Breadcrumb + Actions                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            All Projects
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium">{project.name}</span>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={!hasFiles || isAnalyzing}
            onClick={() => analyzeMutation.mutate()}
            className="gap-2"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </Button>
          <Button
            variant="outline"
            disabled={!analysis}
            onClick={() => navigate(`/projects/${id}/batch`)}
            className="gap-2"
          >
            <ListOrdered className="w-4 h-4" />
            Batch Migrate
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          {!showDeleteConfirm ? (
            <Button
              variant="outline"
              className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-400">Are you sure?</span>
              <Button
                size="sm"
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                No
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Project Info                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card className="py-4">
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold">{project.name}</h1>
                {project.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className="border font-mono text-xs bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
              >
                {project.source_language} &rarr; {project.target_language}
              </Badge>
              <StatusBadge status={project.status} />
            </div>
          </div>

          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border text-sm">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Files:</span>
              <span className="font-medium">{formatNumber(project.file_count)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Lines:</span>
              <span className="font-medium">{formatNumber(project.total_lines)}</span>
            </div>
            {project.dead_code_lines > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Dead code:</span>
                <span className="font-medium text-red-400">
                  {formatNumber(project.dead_code_lines)} lines
                </span>
              </div>
            )}
            {project.migrated_files > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Migrated:</span>
                <span className="font-medium text-emerald-400">
                  {project.migrated_files}/{project.file_count}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/*  File Upload Zone                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Upload Files</h2>
        <FileUploadZone
          projectId={id!}
          onUploadComplete={() => {
            /* files query auto-invalidated */
          }}
        />
        {filesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading files...
          </div>
        ) : (
          <FileList files={files} projectId={id!} />
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Analysis Error                                                    */}
      {/* ------------------------------------------------------------------ */}
      {analyzeMutation.isError && (
        <Card className="py-4 border-red-500/30">
          <CardContent className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400">Analysis failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {analyzeMutation.error.message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Analysis Results (Tabs)                                           */}
      {/* ------------------------------------------------------------------ */}
      {analysis && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Analysis Results</h2>
            <p className="text-xs text-muted-foreground">
              {analysis.total_files} files &middot; {formatNumber(analysis.total_lines)} lines
              &middot; {analysis.dead_code_percentage.toFixed(1)}% dead code
            </p>
          </div>

          {analysis.summary && (
            <Card className="py-3">
              <CardContent>
                <p className="text-sm text-muted-foreground">{analysis.summary}</p>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="dead-code">
            <TabsList variant="line" className="w-full justify-start border-b border-border">
              <TabsTrigger value="dead-code" className="gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Dead Code
              </TabsTrigger>
              <TabsTrigger value="dependencies" className="gap-1.5">
                <Network className="w-4 h-4" />
                Dependencies
              </TabsTrigger>
              <TabsTrigger value="risk" className="gap-1.5">
                <Shield className="w-4 h-4" />
                Risk Heat Map
              </TabsTrigger>
              <TabsTrigger value="migration" className="gap-1.5">
                <ListOrdered className="w-4 h-4" />
                Migration Plan
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dead-code" className="mt-4">
              <DeadCodeTab items={analysis.dead_code} />
            </TabsContent>

            <TabsContent value="dependencies" className="mt-4">
              <DependenciesTab graph={analysis.dependency_graph} />
            </TabsContent>

            <TabsContent value="risk" className="mt-4">
              <RiskHeatMapTab assessments={analysis.risk_assessment} />
            </TabsContent>

            <TabsContent value="migration" className="mt-4">
              <MigrationPlanTab steps={analysis.migration_plan} projectId={id!} />
            </TabsContent>
          </Tabs>
        </section>
      )}
    </div>
  );
}
