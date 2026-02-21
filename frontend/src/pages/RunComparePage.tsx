import { useState } from "react";
import { api } from "@/api/client";
import { useMutation } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Play,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Terminal,
} from "lucide-react";
import type { RunCompareResponse, ExecutionResult } from "@/api/types";

/* ------------------------------------------------------------------ */
/*  Exit Code Badge                                                    */
/* ------------------------------------------------------------------ */

function ExitCodeBadge({
  result,
}: {
  result: ExecutionResult;
}) {
  if (result.timed_out) {
    return (
      <Badge
        variant="outline"
        className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-400"
      >
        <Clock className="size-3 mr-1" />
        Timeout
      </Badge>
    );
  }
  const code = result.exit_code;
  if (code === 0) {
    return (
      <Badge
        variant="outline"
        className="text-xs bg-green-500/10 border-green-500/30 text-green-400"
      >
        exit 0
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-xs bg-red-500/10 border-red-500/30 text-red-400"
    >
      exit {code ?? "N/A"}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Output Column                                                      */
/* ------------------------------------------------------------------ */

function OutputColumn({
  title,
  result,
}: {
  title: string;
  result: ExecutionResult;
}) {
  const [stderrOpen, setStderrOpen] = useState(false);

  return (
    <div className="flex-1 min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <ExitCodeBadge result={result} />
          <span className="text-xs text-muted-foreground">
            {result.execution_time_ms.toFixed(0)}ms
          </span>
        </div>
      </div>

      {/* stdout */}
      <div className="rounded-lg bg-[#0F1117] border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card/30">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            stdout
          </span>
          {result.truncated && (
            <Badge
              variant="outline"
              className="text-[10px] text-amber-400 border-amber-500/30"
            >
              Truncated
            </Badge>
          )}
        </div>
        <pre className="p-4 text-sm font-mono text-muted-foreground overflow-auto max-h-80 whitespace-pre-wrap">
          {result.stdout || "(no output)"}
        </pre>
      </div>

      {/* stderr (collapsible) */}
      {result.stderr && (
        <div className="rounded-lg border border-border overflow-hidden">
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 bg-red-500/5 hover:bg-red-500/10 transition-colors"
            onClick={() => setStderrOpen(!stderrOpen)}
          >
            <AlertCircle className="size-3 text-red-400" />
            <span className="text-[10px] uppercase tracking-wider text-red-400/80">
              stderr
            </span>
            <span className="ml-auto">
              {stderrOpen ? (
                <ChevronUp className="size-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-3 text-muted-foreground" />
              )}
            </span>
          </button>
          {stderrOpen && (
            <pre className="p-4 text-sm font-mono text-red-300/80 bg-[#0F1117] overflow-auto max-h-60 whitespace-pre-wrap">
              {result.stderr}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Diff View                                                          */
/* ------------------------------------------------------------------ */

function DiffView({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Output Diff</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg bg-[#0F1117] border border-border overflow-auto max-h-96">
          <pre className="p-4 text-sm font-mono leading-6">
            {lines.map((line, i) => {
              let lineClass = "text-muted-foreground";
              if (line.startsWith("+")) {
                lineClass = "text-green-400 bg-green-500/10";
              } else if (line.startsWith("-")) {
                lineClass = "text-red-400 bg-red-500/10";
              } else if (line.startsWith("@@")) {
                lineClass = "text-blue-400/60";
              }
              return (
                <div key={i} className={cn("px-2 -mx-2", lineClass)}>
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function RunComparePage() {
  const params = useParams();
  const id = params.id!;
  const filePath = params["*"] ?? "";

  const runMutation = useMutation({
    mutationFn: () => api.runAndCompare(id, filePath),
  });

  const data: RunCompareResponse | undefined = runMutation.data;

  if (!filePath) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <AlertCircle className="size-8" />
          <p className="text-sm">No file selected for comparison.</p>
          <Link to={`/projects/${id}`}>
            <Button variant="outline">Back to Project</Button>
          </Link>
        </div>
      </div>
    );
  }

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
            <Link
              to={`/projects/${id}/transform/${filePath}`}
              className="hover:text-foreground transition-colors"
            >
              Transform
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-foreground font-medium">Run & Compare</span>
          </nav>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Run & Compare
            </h1>
            <span className="text-sm font-mono text-muted-foreground">
              {filePath}
            </span>
          </div>
        </div>

        <Button
          className="bg-[#2DA1E0] hover:bg-[#2590C9]"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
        >
          {runMutation.isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="size-4 mr-2" />
              Run Comparison
            </>
          )}
        </Button>
      </div>

      {/* ---- Error State ---- */}
      {runMutation.isError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle className="size-5 text-red-400 shrink-0" />
          <span className="text-sm text-red-400">
            Execution failed:{" "}
            {runMutation.error instanceof Error
              ? runMutation.error.message
              : "Unknown error"}
          </span>
        </div>
      )}

      {/* ---- Idle State (before first run) ---- */}
      {!data && !runMutation.isPending && !runMutation.isError && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-12">
          <Terminal className="size-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Run both the original Python 2 and migrated Python 3 versions
            side-by-side to verify behavioral equivalence.
          </p>
        </div>
      )}

      {/* ---- Loading State ---- */}
      {runMutation.isPending && !data && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Executing both Python versions...
          </p>
        </div>
      )}

      {/* ---- Results ---- */}
      {data && (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-4 flex-wrap rounded-xl border border-border bg-card p-4">
            {data.outputs_match ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-400" />
                <Badge
                  variant="outline"
                  className="bg-green-500/10 border-green-500/30 text-green-400"
                >
                  Outputs Match
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="size-5 text-red-400" />
                <Badge
                  variant="outline"
                  className="bg-red-500/10 border-red-500/30 text-red-400"
                >
                  Outputs Differ
                </Badge>
              </div>
            )}

            <span className="text-sm text-muted-foreground">
              Similarity:{" "}
              <span
                className={cn("font-semibold", {
                  "text-green-400": data.similarity_pct >= 90,
                  "text-amber-400":
                    data.similarity_pct >= 50 && data.similarity_pct < 90,
                  "text-red-400": data.similarity_pct < 50,
                })}
              >
                {data.similarity_pct.toFixed(1)}%
              </span>
            </span>

            {!data.exit_codes_match && (
              <Badge
                variant="outline"
                className="text-xs bg-red-500/10 border-red-500/30 text-red-400"
              >
                Exit codes differ
              </Badge>
            )}

            <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                <Clock className="size-3 inline mr-1" />
                Py2: {data.py2.execution_time_ms.toFixed(0)}ms
              </span>
              <span>
                <Clock className="size-3 inline mr-1" />
                Py3: {data.py3.execution_time_ms.toFixed(0)}ms
              </span>
            </div>
          </div>

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div className="space-y-2">
              {data.warnings.map((warning, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
                >
                  <AlertTriangle className="size-4 text-amber-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-amber-300">{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Two-column output */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OutputColumn title="Python 2 Original" result={data.py2} />
            <OutputColumn title="Python 3 Migrated" result={data.py3} />
          </div>

          {/* Diff section */}
          {data.diff_lines.length > 0 && (
            <DiffView lines={data.diff_lines} />
          )}
        </>
      )}
    </div>
  );
}
