/** API types matching backend schemas.py */

export type MigrationStatus =
  | "pending"
  | "analyzing"
  | "ready"
  | "in_progress"
  | "completed"
  | "failed";

export type ConfidenceTier =
  | "tier_1_auto_apply"
  | "tier_2_spot_check"
  | "tier_3_review_required"
  | "tier_4_manual_only";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ProjectCreate {
  name: string;
  description?: string;
  source_language?: string;
  target_language?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string;
  source_language: string;
  target_language: string;
  status: MigrationStatus;
  created_at: string;
  file_count: number;
  total_lines: number;
  dead_code_lines: number;
  migrated_files: number;
}

export interface DeadCodeItem {
  file_path: string;
  name: string;
  kind: string;
  line_start: number;
  line_end: number;
  reason: string;
  lines_saved: number;
}

export interface DependencyNode {
  file_path: string;
  imports: string[];
  imported_by: string[];
  external_deps: string[];
  migration_order: number | null;
  circular_deps: string[];
}

export interface RiskAssessment {
  file_path: string;
  risk_level: RiskLevel;
  risk_score: number;
  factors: string[];
  test_coverage_estimate: string;
  semantic_complexity: string;
  recommended_tier: ConfidenceTier;
}

export interface Transformation {
  id: string;
  file_path: string;
  line_start: number;
  line_end: number;
  original_code: string;
  transformed_code: string;
  confidence_tier: ConfidenceTier;
  confidence_score: number;
  reasoning: string;
  change_type: string;
  requires_test: boolean;
}

export interface SnapshotTest {
  file_path: string;
  test_name: string;
  test_code: string;
  covers_functions: string[];
}

export interface MigrationPlanStep {
  order: number;
  file_path: string;
  risk_level: RiskLevel;
  estimated_transformations: number;
  dependencies: string[];
  blocking: string[];
}

export interface AnalysisResponse {
  project_id: string;
  total_files: number;
  total_lines: number;
  dead_code: DeadCodeItem[];
  dead_code_lines: number;
  dead_code_percentage: number;
  dependency_graph: Record<string, DependencyNode>;
  risk_assessment: RiskAssessment[];
  migration_plan: MigrationPlanStep[];
  summary: string;
}

export interface FileTransformationResponse {
  project_id: string;
  file_path: string;
  transformations: Transformation[];
  snapshot_tests: SnapshotTest[];
  overall_confidence: number;
  overall_tier: ConfidenceTier;
  original_lines: number;
  transformed_lines: number;
}

export interface DashboardResponse {
  project_id: string;
  project_name: string;
  status: MigrationStatus;
  total_files: number;
  migrated_files: number;
  migration_percentage: number;
  total_lines: number;
  dead_code_lines: number;
  lines_after_cleanup: number;
  risk_distribution: Record<string, number>;
  confidence_distribution: Record<string, number>;
  migration_plan: MigrationPlanStep[];
  blockers: string[];
  recent_transformations: Transformation[];
}

export interface HealthResponse {
  status: string;
  version: string;
  features: string[];
}

export interface FileInfo {
  file_path: string;
  lines: number;
  migrated: boolean;
}

export interface BatchResult {
  file_path: string;
  status: "success" | "error";
  transformations?: number;
  overall_confidence?: number;
  overall_tier?: string;
  error?: string;
}

export interface ExecutionResult {
  exit_code: number | null;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
  timed_out: boolean;
  truncated: boolean;
}

export interface RunFileResponse {
  project_id: string;
  file_path: string;
  result: ExecutionResult;
  warnings: string[];
}

export interface RunCompareResponse {
  project_id: string;
  file_path: string;
  py2: ExecutionResult;
  py3: ExecutionResult;
  outputs_match: boolean;
  exit_codes_match: boolean;
  diff_lines: string[];
  similarity_pct: number;
  warnings: string[];
}
