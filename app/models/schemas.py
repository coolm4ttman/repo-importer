from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class MigrationStatus(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    READY = "ready"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ConfidenceTier(str, Enum):
    TIER_1_AUTO = "tier_1_auto_apply"
    TIER_2_SPOT = "tier_2_spot_check"
    TIER_3_REVIEW = "tier_3_review_required"
    TIER_4_MANUAL = "tier_4_manual_only"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# --- Request models ---


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    source_language: str = "python2"
    target_language: str = "python3"


class MigrateFileRequest(BaseModel):
    project_id: str
    file_path: str


class MigrateBatchRequest(BaseModel):
    # FIX 10: Removed project_id — it's already a URL path parameter
    file_paths: list[str] | None = None  # None = all files in recommended order


class TransformationFeedback(BaseModel):
    approved: bool
    notes: str = ""


# --- Core domain models ---


class DeadCodeItem(BaseModel):
    file_path: str
    name: str
    kind: str  # "function", "class", "import", "variable"
    line_start: int
    line_end: int
    reason: str
    lines_saved: int


class DependencyNode(BaseModel):
    file_path: str
    imports: list[str]
    imported_by: list[str]
    external_deps: list[str]
    migration_order: int | None = None
    circular_deps: list[str] = []


class RiskAssessment(BaseModel):
    file_path: str
    risk_level: RiskLevel
    risk_score: float = Field(ge=0.0, le=1.0)
    factors: list[str]
    test_coverage_estimate: str
    semantic_complexity: str
    recommended_tier: ConfidenceTier


class Transformation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    file_path: str
    line_start: int
    line_end: int
    original_code: str
    transformed_code: str
    confidence_tier: ConfidenceTier
    confidence_score: float = Field(ge=0.0, le=1.0)
    reasoning: str
    change_type: str  # "syntax", "semantic", "api_change", "behavioral"
    requires_test: bool = False


class SnapshotTest(BaseModel):
    file_path: str
    test_name: str
    test_code: str
    covers_functions: list[str]


class MigrationPlanStep(BaseModel):
    order: int
    file_path: str
    risk_level: RiskLevel
    estimated_transformations: int
    dependencies: list[str]
    blocking: list[str]


# --- Response models ---


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    source_language: str
    target_language: str
    status: MigrationStatus
    created_at: datetime
    file_count: int = 0
    total_lines: int = 0
    dead_code_lines: int = 0
    migrated_files: int = 0


class AnalysisResponse(BaseModel):
    project_id: str
    total_files: int
    total_lines: int
    dead_code: list[DeadCodeItem]
    dead_code_lines: int
    dead_code_percentage: float
    dependency_graph: dict[str, DependencyNode]
    risk_assessment: list[RiskAssessment]
    migration_plan: list[MigrationPlanStep]
    summary: str


class FileTransformationResponse(BaseModel):
    project_id: str
    file_path: str
    transformations: list[Transformation]
    snapshot_tests: list[SnapshotTest]
    overall_confidence: float
    overall_tier: ConfidenceTier
    original_lines: int
    transformed_lines: int


class DashboardResponse(BaseModel):
    project_id: str
    project_name: str
    status: MigrationStatus
    total_files: int
    migrated_files: int
    migration_percentage: float
    total_lines: int
    dead_code_lines: int
    lines_after_cleanup: int
    risk_distribution: dict[str, int]
    confidence_distribution: dict[str, int]
    migration_plan: list[MigrationPlanStep]
    blockers: list[str]
    recent_transformations: list[Transformation]


class HealthResponse(BaseModel):
    status: str
    version: str
    features: list[str]
