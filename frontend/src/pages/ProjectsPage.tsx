import { useState } from "react";
import { api } from "@/api/client";
import type { ProjectResponse } from "@/api/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { cn, formatNumber } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ProgressBar } from "@/components/shared/ProgressBar";
import {
  FolderOpen,
  FileCode,
  Code2,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ---------- Language options ---------- */

const SOURCE_LANGUAGES = [
  { value: "python2", label: "Python 2" },
  { value: "java8", label: "Java 8" },
];

const TARGET_LANGUAGES = [
  { value: "python3", label: "Python 3" },
  { value: "java17", label: "Java 17" },
];

/* ---------- Language display map ---------- */

const LANG_DISPLAY: Record<string, string> = {
  python2: "Python 2",
  python3: "Python 3",
  java8: "Java 8",
  java17: "Java 17",
};

function langLabel(value: string): string {
  return LANG_DISPLAY[value] ?? value;
}

/* ---------- Stat Card ---------- */

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  const animatedValue = useCountUp(value);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#36B7FC]/10">
        <Icon className="h-5 w-5 text-[#36B7FC]" />
      </div>
      <div>
        <p className="text-2xl font-bold font-mono tabular-nums">
          {formatNumber(animatedValue)}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/* ---------- Project Card ---------- */

function ProjectCard({ project }: { project: ProjectResponse }) {
  const navigate = useNavigate();
  const progress =
    project.file_count > 0
      ? Math.round((project.migrated_files / project.file_count) * 100)
      : 0;

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project.id}`)}
      className={cn(
        "group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-left",
        "transition-all duration-200 hover:translate-y-[-2px] hover:shadow-lg hover:shadow-black/20 hover:border-border/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Language badge */}
          <span className="mb-2 inline-block rounded-md bg-[#36B7FC]/10 px-2 py-0.5 text-xs font-medium text-[#36B7FC] font-mono">
            {langLabel(project.source_language)} &rarr;{" "}
            {langLabel(project.target_language)}
          </span>
          <h3 className="truncate text-base font-semibold text-foreground group-hover:text-[#36B7FC] transition-colors">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>
        <StatusBadge status={project.status} />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileCode className="h-3.5 w-3.5" />
          <span className="font-mono">{formatNumber(project.file_count)}</span>{" "}
          files
        </span>
        <span className="flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5" />
          <span className="font-mono">
            {formatNumber(project.total_lines)}
          </span>{" "}
          lines
        </span>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Migration progress</span>
          <span className="font-mono font-medium text-foreground">
            {progress}%
          </span>
        </div>
        <ProgressBar value={project.migrated_files} max={project.file_count} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {new Date(project.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 text-[#36B7FC]">
          Open project <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

/* ---------- Create Project Ghost Card ---------- */

function CreateProjectGhostCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 p-8",
        "text-muted-foreground transition-all duration-200",
        "hover:border-[#36B7FC]/50 hover:text-[#36B7FC] hover:translate-y-[-2px] hover:shadow-lg hover:shadow-black/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "min-h-[200px]",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-current">
        <Plus className="h-6 w-6" />
      </div>
      <span className="text-sm font-medium">Create New Project</span>
    </button>
  );
}

/* ---------- Create Project Dialog ---------- */

function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("python2");
  const [targetLanguage, setTargetLanguage] = useState("python3");

  const createMutation = useMutation({
    mutationFn: api.createProject,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onOpenChange(false);
      resetForm();
      navigate(`/projects/${project.id}`);
    },
  });

  function resetForm() {
    setName("");
    setDescription("");
    setSourceLanguage("python2");
    setTargetLanguage("python3");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      source_language: sourceLanguage,
      target_language: targetLanguage,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Set up a new migration project to analyze and transform your legacy
            code.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">
              Project Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="project-name"
              placeholder="e.g. legacy-api-migration"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="Brief description of the migration project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20 resize-none"
            />
          </div>

          {/* Language selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Source Language</Label>
              <Select
                value={sourceLanguage}
                onValueChange={setSourceLanguage}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Language</Label>
              <Select
                value={targetLanguage}
                onValueChange={setTargetLanguage}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Error */}
          {createMutation.isError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to create project"}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Main Page ---------- */

export function ProjectsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    data: projects,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });

  // Compute aggregate stats
  const totalProjects = projects?.length ?? 0;
  const filesMigrated =
    projects?.reduce((sum, p) => sum + p.migrated_files, 0) ?? 0;
  const linesSaved =
    projects?.reduce((sum, p) => sum + p.dead_code_lines, 0) ?? 0;

  return (
    <div className="min-h-full p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your legacy code migration projects
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Quick stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={FolderOpen}
          label="Total Projects"
          value={totalProjects}
        />
        <StatCard
          icon={FileCode}
          label="Files Migrated"
          value={filesMigrated}
        />
        <StatCard icon={Code2} label="Lines Saved" value={linesSaved} />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 py-16">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-sm text-red-400">
            {error instanceof Error
              ? error.message
              : "Failed to load projects"}
          </p>
        </div>
      )}

      {/* Project grid */}
      {projects && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          <CreateProjectGhostCard onClick={() => setDialogOpen(true)} />
        </div>
      )}

      {/* Empty state (no projects, not loading) */}
      {projects && projects.length === 0 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            No projects yet. Create your first project to get started.
          </p>
        </div>
      )}

      {/* Create dialog */}
      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
