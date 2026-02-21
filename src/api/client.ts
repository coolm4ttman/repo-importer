/** API client for CodeShift AI backend. */

import type {
  AnalysisResponse,
  BatchResult,
  DashboardResponse,
  FileInfo,
  FileTransformationResponse,
  ProjectCreate,
  ProjectResponse,
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

  // Export
  exportProject: async (projectId: string) => {
    const res = await fetch(`${BASE}/projects/${projectId}/export`);
    if (!res.ok) throw new Error("Export failed");
    return res.blob();
  },
};
