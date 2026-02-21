/** API client for Reforge AI backend. */

import type {
  AnalysisResponse,
  BatchResult,
  DashboardResponse,
  FileInfo,
  FileTransformationResponse,
  ProjectCreate,
  ProjectResponse,
  RunCompareResponse,
  RunFileResponse,
} from "./types";

const BASE = "/api/v1";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Projects
export const api = {
  listProjects: () => request<ProjectResponse[]>("/projects"),

  getProject: (id: string) => request<ProjectResponse>(`/projects/${id}`),

  createProject: (data: ProjectCreate) =>
    request<ProjectResponse>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteProject: (id: string) =>
    request<{ deleted: boolean }>(`/projects/${id}`, { method: "DELETE" }),

  // Files
  uploadFiles: async (projectId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const res = await fetch(`${BASE}/projects/${projectId}/files`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<{ uploaded: number; files: FileInfo[] }>;
  },

  listFiles: (projectId: string) =>
    request<{ project_id: string; files: FileInfo[] }>(
      `/projects/${projectId}/files`,
    ),

  getFileContent: (projectId: string, filePath: string, version = "original") =>
    request<{ file_path: string; version: string; content: string; lines: number }>(
      `/projects/${projectId}/files/${filePath}?version=${version}`,
    ),

  // Analysis
  analyzeProject: (projectId: string) =>
    request<AnalysisResponse>(`/projects/${projectId}/analyze`, {
      method: "POST",
    }),

  // Transformation
  getTransformations: (projectId: string, filePath: string) =>
    request<FileTransformationResponse>(
      `/projects/${projectId}/transform/${filePath}`,
    ),

  transformFile: (projectId: string, filePath: string) =>
    request<FileTransformationResponse>(
      `/projects/${projectId}/transform/${filePath}`,
      { method: "POST" },
    ),

  transformBatch: (projectId: string, filePaths?: string[]) =>
    request<{ project_id: string; processed: number; results: BatchResult[] }>(
      `/projects/${projectId}/transform-batch`,
      {
        method: "POST",
        body: JSON.stringify(filePaths ? { file_paths: filePaths } : {}),
      },
    ),

  // Dashboard
  getDashboard: (projectId: string) =>
    request<DashboardResponse>(`/projects/${projectId}/dashboard`),

  // Diff
  getFileDiff: (projectId: string, filePath: string) =>
    request<{ file_path: string; diff: string; transformations_applied: number }>(
      `/projects/${projectId}/diff/${filePath}`,
    ),

  // Slack Report
  sendSlackReport: (projectId: string, webhookUrl?: string) =>
    request<{ status: string; project_name?: string; error?: string }>(
      `/projects/${projectId}/report-slack${webhookUrl ? `?webhook_url=${encodeURIComponent(webhookUrl)}` : ""}`,
      { method: "POST" },
    ),

  // Run (migrated code only)
  runFile: (projectId: string, filePath: string, options?: {
    timeout_seconds?: number;
    stdin_input?: string;
  }) =>
    request<RunFileResponse>(
      `/projects/${projectId}/run/${filePath}`,
      { method: "POST", body: JSON.stringify(options ?? {}) }
    ),

  // Run & Compare
  runAndCompare: (projectId: string, filePath: string, options?: {
    timeout_seconds?: number;
    stdin_input?: string;
  }) =>
    request<RunCompareResponse>(
      `/projects/${projectId}/run-compare/${filePath}`,
      { method: "POST", body: JSON.stringify(options ?? {}) }
    ),

  // Export
  exportProject: async (projectId: string) => {
    const res = await fetch(`${BASE}/projects/${projectId}/export`);
    if (!res.ok) throw new Error("Export failed");
    return res.blob();
  },
};
