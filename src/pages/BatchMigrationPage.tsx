import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  cn,
  riskBg,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Play,
  Pause,
  Square,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ExternalLink,
} from "lucide-react";
import type { MigrationPlanStep } from "@/api/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FileStatus = "pending" | "running" | "success" | "error";

interface QueueItem {
  order: number;
  filePath: string;
  riskLevel: string;
  status: FileStatus;
  transformationCount: number | null;
  confidenceScore: number | null;
  overallTier: string | null;
  error: string | null;
}

interface LogEntry {
  timestamp: string;
  message: string;
  level: "info" | "success" | "error" | "warn";
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function now(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function StatusIcon({ status }: { status: FileStatus }) {
  switch (status) {
    case "pending":
      return <Clock className="size-4 text-gray-400" />;
    case "running":
      return <Loader2 className="size-4 text-blue-400 animate-spin" />;
    case "success":
      return <CheckCircle2 className="size-4 text-emerald-400" />;
    case "error":
      return <XCircle className="size-4 text-red-400" />;
  }
}

function statusLabel(status: FileStatus): string {
  const map: Record<FileStatus, string> = {
    pending: "Pending",
    running: "Running",
    success: "Complete",
    error: "Error",
  };
  return map[status];
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function BatchMigrationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch dashboard to get migration plan order
  const { data: dashboard, isLoading: isDashboardLoading } = useQuery({
    queryKey: ["dashboard", id],
    queryFn: () => api.getDashboard(id!),
  });

  // State
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Refs for controlling the async loop
  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);
  const logPanelRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<QueueItem[]>([]);

  // Keep ref in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);

  // Auto-scroll log panel
  useEffect(() => {
    if (logPanelRef.current) {
      logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
    }
  }, [logs]);

  // Initialize queue from dashboard migration plan
  useEffect(() => {
    if (dashboard && queue.length === 0) {
      const items: QueueItem[] = dashboard.migration_plan.map(
        (step: MigrationPlanStep) => ({
          order: step.order,
          filePath: step.file_path,
          riskLevel: step.risk_level,
          status: "pending" as FileStatus,
          transformationCount: null,
          confidenceScore: null,
          overallTier: null,
          error: null,
        }),
      );
      setQueue(items);
    }
  }, [dashboard, queue.length]);

  const addLog = useCallback(
    (message: string, level: LogEntry["level"] = "info") => {
      setLogs((prev) => [...prev, { timestamp: now(), message, level }]);
    },
    [],
  );

  const processedCount = queue.filter(
    (q) => q.status === "success" || q.status === "error",
  ).length;
  const totalCount = queue.length;
  const progressPct = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;

  // Start migration
  const startMigration = useCallback(async () => {
    const currentQueue = queueRef.current;
    if (currentQueue.length === 0) return;

    setIsRunning(true);
    setIsPaused(false);
    pausedRef.current = false;
    cancelledRef.current = false;
    addLog("Starting batch migration...", "info");

    let startIdx = currentIndex;
    // If we've already completed all, restart
    if (startIdx >= currentQueue.length) {
      startIdx = 0;
      setCurrentIndex(0);
      setQueue((prev) =>
        prev.map((q) => ({
          ...q,
          status: "pending",
          transformationCount: null,
          confidenceScore: null,
          overallTier: null,
          error: null,
        })),
      );
    }

    // Design choice: We use sequential per-file transform calls (api.transformFile)
    // instead of the batch endpoint (api.transformBatch) intentionally. This allows
    // real-time per-file progress updates in the UI (status, log entries, pause/cancel)
    // which would not be possible with a single batch request.
    for (let i = startIdx; i < currentQueue.length; i++) {
      // Check for cancel
      if (cancelledRef.current) {
        addLog("Migration cancelled by user.", "warn");
        break;
      }

      // Check for pause - wait in a loop
      while (pausedRef.current && !cancelledRef.current) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (cancelledRef.current) {
        addLog("Migration cancelled by user.", "warn");
        break;
      }

      const item = queueRef.current[i];
      setCurrentIndex(i);

      // Mark current as running
      setQueue((prev) =>
        prev.map((q, idx) =>
          idx === i ? { ...q, status: "running" } : q,
        ),
      );
      addLog(`Processing file ${i + 1}/${currentQueue.length}: ${item.filePath}`, "info");

      try {
        const result = await api.transformFile(id!, item.filePath);
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i
              ? {
                  ...q,
                  status: "success",
                  transformationCount: result.transformations.length,
                  confidenceScore: result.overall_confidence,
                  overallTier: result.overall_tier,
                }
              : q,
          ),
        );
        addLog(
          `Completed ${item.filePath}: ${result.transformations.length} transformations, confidence ${Math.round(result.overall_confidence * 100)}%`,
          "success",
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error";
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i
              ? { ...q, status: "error", error: msg }
              : q,
          ),
        );
        addLog(`Error processing ${item.filePath}: ${msg}`, "error");
      }
    }

    if (!cancelledRef.current) {
      addLog("Batch migration complete!", "success");
    }

    // Invalidate stale caches so dashboard and project views reflect new state
    queryClient.invalidateQueries({ queryKey: ["project", id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", id] });

    setIsRunning(false);
    setIsPaused(false);
    setCurrentIndex(queueRef.current.length);
  }, [currentIndex, id, addLog, queryClient]);

  // Pause / Resume
  const togglePause = useCallback(() => {
    if (isPaused) {
      pausedRef.current = false;
      setIsPaused(false);
      addLog("Migration resumed.", "info");
    } else {
      pausedRef.current = true;
      setIsPaused(true);
      addLog("Migration paused. Will stop after current file.", "warn");
    }
  }, [isPaused, addLog]);

  // Cancel
  const cancelMigration = useCallback(() => {
    cancelledRef.current = true;
    pausedRef.current = false;
    setShowCancelConfirm(false);
    setIsPaused(false);
  }, []);

  if (isDashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading migration plan...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ---- Breadcrumb ---- */}
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
        <span className="text-foreground font-medium">Batch Migration</span>
      </nav>

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Batch Migration</h1>
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <Button
              onClick={startMigration}
              disabled={queue.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Play className="size-4 mr-2" />
              {processedCount > 0 && processedCount < totalCount
                ? "Resume Migration"
                : "Start Migration"}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={togglePause}
              >
                {isPaused ? (
                  <>
                    <Play className="size-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="size-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              {!showCancelConfirm ? (
                <Button
                  variant="outline"
                  className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  <Square className="size-4 mr-2" />
                  Cancel
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-400">Are you sure?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={cancelMigration}
                  >
                    Yes, Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCancelConfirm(false)}
                  >
                    No
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ---- Overall Progress Bar ---- */}
      <Card className="bg-card border border-border rounded-xl p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {processedCount} / {totalCount} files processed
            </span>
            <span className="text-sm font-mono text-muted-foreground">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {isRunning && isPaused && (
            <p className="text-xs text-amber-400 flex items-center gap-1">
              <Pause className="size-3" /> Paused - will resume after you click
              Resume
            </p>
          )}
        </div>
      </Card>

      {/* ---- File Queue Table ---- */}
      <Card className="bg-card border border-border rounded-xl overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base">File Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-12">
                    #
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                    File
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-24">
                    Risk
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-28">
                    Status
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground w-24">
                    Changes
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground w-28">
                    Confidence
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground w-12" />
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr
                    key={item.order}
                    className={cn(
                      "border-b border-border/50 transition-colors",
                      item.status === "running" &&
                        "bg-blue-500/5 animate-pulse",
                      item.status === "success" &&
                        "cursor-pointer hover:bg-muted/30",
                      item.status === "error" && "bg-red-500/5",
                    )}
                    onClick={() => {
                      if (item.status === "success") {
                        navigate(
                          `/projects/${id}/transform/${item.filePath}`,
                        );
                      }
                    }}
                  >
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {item.order}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{item.filePath}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          riskBg(item.riskLevel),
                        )}
                      >
                        {item.riskLevel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={item.status} />
                        <span
                          className={cn("text-xs", {
                            "text-gray-400": item.status === "pending",
                            "text-blue-400": item.status === "running",
                            "text-emerald-400": item.status === "success",
                            "text-red-400": item.status === "error",
                          })}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {item.transformationCount !== null
                        ? item.transformationCount
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.confidenceScore !== null ? (
                        <span className="font-mono text-xs">
                          {Math.round(item.confidenceScore * 100)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {"\u2014"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.status === "success" && (
                        <ExternalLink className="size-3 text-muted-foreground" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ---- Live Log Panel ---- */}
      <Card className="bg-card border border-border rounded-xl overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="size-4" />
            Live Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={logPanelRef}
            className="h-64 overflow-auto bg-[#0F1117] p-4 font-mono text-xs leading-5"
          >
            {logs.length === 0 ? (
              <p className="text-muted-foreground/50">
                Logs will appear here when migration starts...
              </p>
            ) : (
              logs.map((entry, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground/40 shrink-0 select-none">
                    [{entry.timestamp}]
                  </span>
                  <span
                    className={cn({
                      "text-gray-400": entry.level === "info",
                      "text-green-400": entry.level === "success",
                      "text-red-400": entry.level === "error",
                      "text-amber-400": entry.level === "warn",
                    })}
                  >
                    {entry.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
