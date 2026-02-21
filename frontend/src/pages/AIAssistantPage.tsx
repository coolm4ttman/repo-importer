import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { AnalysisResponse } from "@/api/types";
import AIMessageBar from "@/components/ui/ai-assistat";
import { Loader2 } from "lucide-react";

export function AIAssistantPage() {
  const { id } = useParams<{ id: string }>();

  const projectQuery = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });

  const isAnalyzed = projectQuery.data
    ? ["ready", "in_progress", "completed"].includes(projectQuery.data.status)
    : false;

  const analysisQuery = useQuery<AnalysisResponse>({
    queryKey: ["project-analysis", id],
    queryFn: () => api.analyzeProject(id!),
    enabled: isAnalyzed,
    staleTime: Infinity,
  });

  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const project = projectQuery.data;
  const analysis = analysisQuery.data;

  const projectContext = project
    ? {
        name: project.name,
        summary: analysis?.summary,
        fileCount: project.file_count,
        totalLines: project.total_lines,
        deadCodeLines: project.dead_code_lines,
        migratedFiles: project.migrated_files,
        status: project.status,
        riskAssessments: analysis?.risk_assessment,
        migrationPlan: analysis?.migration_plan,
        deadCode: analysis?.dead_code,
      }
    : undefined;

  return (
    <div className="h-full">
      <AIMessageBar projectContext={projectContext} />
    </div>
  );
}
