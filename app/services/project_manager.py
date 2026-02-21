"""Project manager — orchestrates the full migration lifecycle.

Manages project state, coordinates analysis phases, and tracks
migration progress across files.
"""

from __future__ import annotations

import asyncio
import difflib
import io
import json
import os
import shutil
import uuid
import zipfile
from datetime import datetime, timezone

from app.core.config import settings
from app.models.schemas import (
    AnalysisResponse,
    ConfidenceTier,
    DashboardResponse,
    FileTransformationResponse,
    MigrationPlanStep,
    MigrationStatus,
    ProjectResponse,
    RiskLevel,
    Transformation,
)
from app.services.analyzers.dead_code import detect_dead_code
from app.services.analyzers.dependency_graph import build_dependency_graph, get_migration_order
from app.services.analyzers.risk_assessor import assess_risks
from app.services.test_generator import generate_llm_snapshot_tests, generate_snapshot_tests
from app.services.transformer import apply_deterministic_rules, apply_llm_transformations


# In-memory store (swap for DB in production)
_projects: dict[str, dict] = {}


def _project_dir(project_id: str) -> str:
    return os.path.join(settings.upload_dir, project_id)


def _safe_path(project_id: str, subdirectory: str, file_path: str) -> str:
    """Validate file_path stays within the project subdirectory. Returns resolved path."""
    base = os.path.realpath(os.path.join(_project_dir(project_id), subdirectory))
    full = os.path.realpath(os.path.join(base, file_path))
    if not full.startswith(base + os.sep) and full != base:
        raise ValueError("Path traversal detected")
    return full


def create_project(name: str, description: str, source_lang: str, target_lang: str) -> ProjectResponse:
    project_id = str(uuid.uuid4())[:12]
    project_path = _project_dir(project_id)
    os.makedirs(os.path.join(project_path, "source"), exist_ok=True)
    os.makedirs(os.path.join(project_path, "migrated"), exist_ok=True)
    os.makedirs(os.path.join(project_path, "tests"), exist_ok=True)

    project = {
        "id": project_id,
        "name": name,
        "description": description,
        "source_language": source_lang,
        "target_language": target_lang,
        "status": MigrationStatus.PENDING,
        "created_at": datetime.now(timezone.utc),
        "files": {},
        "analysis": None,
        "transformations": {},
    }
    _projects[project_id] = project
    return _project_response(project)


def get_project(project_id: str) -> ProjectResponse | None:
    project = _projects.get(project_id)
    if not project:
        return None
    return _project_response(project)


def list_projects() -> list[ProjectResponse]:
    return [_project_response(p) for p in _projects.values()]


def save_file(project_id: str, filename: str, content: bytes) -> dict:
    project = _projects.get(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    # FIX 1: Sanitize filename to prevent path traversal
    safe_name = os.path.basename(filename)
    if not safe_name or safe_name.startswith('.'):
        raise ValueError(f"Invalid filename: {filename}")
    file_path = os.path.join(_project_dir(project_id), "source", safe_name)
    real_path = os.path.realpath(file_path)
    allowed_prefix = os.path.realpath(os.path.join(_project_dir(project_id), "source"))
    if not real_path.startswith(allowed_prefix + os.sep) and real_path != allowed_prefix:
        raise ValueError("Path traversal detected")

    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(content)

    decoded = content.decode("utf-8", errors="replace")
    lines = decoded.count("\n") + 1 if decoded else 0
    project["files"][safe_name] = {"lines": lines, "migrated": False}

    return {"filename": safe_name, "lines": lines}


def analyze_project(project_id: str) -> AnalysisResponse:
    project = _projects.get(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    project["status"] = MigrationStatus.ANALYZING
    source_dir = os.path.join(_project_dir(project_id), "source")

    # Phase 1: Dead code detection
    dead_code = detect_dead_code(source_dir)
    dead_lines = sum(d.lines_saved for d in dead_code)

    # Phase 2: Dependency graph
    dep_graph = build_dependency_graph(source_dir)

    # Phase 3: Risk assessment
    risks = assess_risks(source_dir, dep_graph)

    # Phase 4: Migration plan (topologically sorted)
    migration_order = get_migration_order(dep_graph)
    plan: list[MigrationPlanStep] = []
    for i, fpath in enumerate(migration_order):
        node = dep_graph.get(fpath)
        risk = next((r for r in risks if r.file_path == fpath), None)
        plan.append(MigrationPlanStep(
            order=i + 1,
            file_path=fpath,
            risk_level=risk.risk_level if risk else RiskLevel.MEDIUM,
            estimated_transformations=0,
            dependencies=[d for d in (node.imports if node else [])],
            blocking=node.imported_by if node else [],
        ))

    total_files = len(dep_graph)
    total_lines = sum(info["lines"] for info in project["files"].values())

    analysis = AnalysisResponse(
        project_id=project_id,
        total_files=total_files,
        total_lines=total_lines,
        dead_code=dead_code,
        dead_code_lines=dead_lines,
        dead_code_percentage=round(dead_lines / max(total_lines, 1) * 100, 1),
        dependency_graph=dep_graph,
        risk_assessment=risks,
        migration_plan=plan,
        summary=_build_summary(total_files, total_lines, dead_lines, risks),
    )

    project["analysis"] = analysis
    project["status"] = MigrationStatus.READY
    return analysis


async def transform_file(project_id: str, file_path: str) -> FileTransformationResponse:
    project = _projects.get(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    full_path = _safe_path(project_id, "source", file_path)
    if not os.path.exists(full_path):
        raise ValueError(f"File {file_path} not found in project")

    with open(full_path) as f:
        source = f.read()

    project["status"] = MigrationStatus.IN_PROGRESS

    # FIX 2: Wrap transformation in try/except for COMPLETED/FAILED transitions
    try:
        # Phase 1: Deterministic transformations (Tier 1) — instant
        det_transforms = apply_deterministic_rules(source, file_path)
        static_tests = generate_snapshot_tests(source, file_path)

        # Phase 2: LLM calls in parallel for speed
        llm_transforms, llm_tests = await asyncio.gather(
            apply_llm_transformations(source, file_path),
            generate_llm_snapshot_tests(source, file_path),
        )

        all_transforms = det_transforms + llm_transforms
        all_tests = static_tests + llm_tests

        # Compute overall confidence
        if all_transforms:
            scores = [t.confidence_score for t in all_transforms if t.confidence_score > 0]
            overall_score = sum(scores) / len(scores) if scores else 0.0
        else:
            overall_score = 1.0

        overall_tier = _overall_tier(all_transforms)

        # Save state
        project["transformations"][file_path] = {
            "transforms": all_transforms,
            "tests": all_tests,
        }

        # Write migrated file
        migrated_source = _apply_transformations(source, det_transforms)
        migrated_path = _safe_path(project_id, "migrated", file_path)
        os.makedirs(os.path.dirname(migrated_path), exist_ok=True)
        with open(migrated_path, "w") as f:
            f.write(migrated_source)

        # Write snapshot tests (concatenate all into a single file)
        if all_tests:
            test_path = os.path.join(_project_dir(project_id), "tests", f"test_{os.path.basename(file_path)}")
            combined_test_code = "\n\n".join(test.test_code for test in all_tests)
            with open(test_path, "w") as f:
                f.write(combined_test_code)

        project["files"].get(file_path, {}).update({"migrated": True})

        # FIX 2: Transition to COMPLETED if all files are migrated
        all_migrated = all(
            f_info.get("migrated") for f_info in project["files"].values()
        )
        if all_migrated and project["files"]:
            project["status"] = MigrationStatus.COMPLETED

        return FileTransformationResponse(
            project_id=project_id,
            file_path=file_path,
            transformations=all_transforms,
            snapshot_tests=all_tests,
            overall_confidence=round(overall_score, 3),
            overall_tier=overall_tier,
            original_lines=source.count("\n") + 1,
            transformed_lines=migrated_source.count("\n") + 1,
        )
    except Exception:
        # FIX 2: Set FAILED status on error
        project["status"] = MigrationStatus.FAILED
        raise


def get_dashboard(project_id: str) -> DashboardResponse:
    project = _projects.get(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    analysis = project.get("analysis")
    total_files = len(project["files"])
    migrated_files = sum(1 for f in project["files"].values() if f.get("migrated"))
    total_lines = sum(f["lines"] for f in project["files"].values())

    risk_dist: dict[str, int] = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    conf_dist: dict[str, int] = {t.value: 0 for t in ConfidenceTier}
    plan: list[MigrationPlanStep] = []

    if analysis:
        for r in analysis.risk_assessment:
            risk_dist[r.risk_level.value] = risk_dist.get(r.risk_level.value, 0) + 1
        plan = analysis.migration_plan

    recent_transforms: list[Transformation] = []
    for file_data in project["transformations"].values():
        recent_transforms.extend(file_data["transforms"][:5])

    for t in recent_transforms:
        conf_dist[t.confidence_tier.value] = conf_dist.get(t.confidence_tier.value, 0) + 1

    dead_lines = analysis.dead_code_lines if analysis else 0

    return DashboardResponse(
        project_id=project_id,
        project_name=project["name"],
        status=project["status"],
        total_files=total_files,
        migrated_files=migrated_files,
        migration_percentage=round(migrated_files / max(total_files, 1) * 100, 1),
        total_lines=total_lines,
        dead_code_lines=dead_lines,
        lines_after_cleanup=total_lines - dead_lines,
        risk_distribution=risk_dist,
        confidence_distribution=conf_dist,
        migration_plan=plan,
        blockers=[],
        recent_transformations=recent_transforms[:10],
    )


# ── File & project operations for API endpoints ─────────────────────────


def get_file_diff(project_id: str, file_path: str) -> dict:
    """Return unified diff between original and migrated file with confidence annotations."""
    project = _projects.get(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    source_path = _safe_path(project_id, "source", file_path)
    migrated_path = _safe_path(project_id, "migrated", file_path)

    if not os.path.exists(source_path):
        raise ValueError(f"Source file {file_path} not found")

    with open(source_path) as f:
        original_lines = f.readlines()

    if not os.path.exists(migrated_path):
        return {
            "file_path": file_path,
            "status": "not_migrated",
            "diff": "",
            "original_lines": len(original_lines),
            "migrated_lines": 0,
            "confidence": None,
        }

    with open(migrated_path) as f:
        migrated_lines = f.readlines()

    diff = list(difflib.unified_diff(
        original_lines,
        migrated_lines,
        fromfile=f"a/{file_path}",
        tofile=f"b/{file_path}",
        lineterm="",
    ))

    # Get confidence info from transformations
    transform_data = project.get("transformations", {}).get(file_path)
    confidence = None
    if transform_data:
        transforms = transform_data.get("transforms", [])
        if transforms:
            scores = [t.confidence_score for t in transforms if t.confidence_score > 0]
            confidence = round(sum(scores) / len(scores), 3) if scores else 0.0

    return {
        "file_path": file_path,
        "status": "migrated",
        "diff": "\n".join(diff),
        "original_lines": len(original_lines),
        "migrated_lines": len(migrated_lines),
        "confidence": confidence,
    }


def export_project(project_id: str) -> io.BytesIO:
    """Export project as a ZIP containing migrated source, tests, and migration report."""
    project = _projects.get(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    project_path = _project_dir(project_id)
    buf = io.BytesIO()

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add migrated source files
        migrated_dir = os.path.join(project_path, "migrated")
        if os.path.exists(migrated_dir):
            for root, _, filenames in os.walk(migrated_dir):
                for fname in filenames:
                    full = os.path.join(root, fname)
                    arcname = os.path.join("migrated", os.path.relpath(full, migrated_dir))
                    zf.write(full, arcname)

        # Add generated tests
        tests_dir = os.path.join(project_path, "tests")
        if os.path.exists(tests_dir):
            for root, _, filenames in os.walk(tests_dir):
                for fname in filenames:
                    full = os.path.join(root, fname)
                    arcname = os.path.join("tests", os.path.relpath(full, tests_dir))
                    zf.write(full, arcname)

        # Add migration report JSON
        report = {
            "project_id": project_id,
            "project_name": project["name"],
            "source_language": project["source_language"],
            "target_language": project["target_language"],
            "status": project["status"].value if hasattr(project["status"], "value") else str(project["status"]),
            "total_files": len(project["files"]),
            "migrated_files": sum(1 for f in project["files"].values() if f.get("migrated")),
            "files": {
                fname: {
                    "lines": info["lines"],
                    "migrated": info.get("migrated", False),
                }
                for fname, info in project["files"].items()
            },
        }
        zf.writestr("migration_report.json", json.dumps(report, indent=2))

    buf.seek(0)
    return buf


def list_files(project_id: str) -> list[dict]:
    """List all uploaded files with line counts and migration status."""
    project = _projects.get(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    result = []
    for fname, info in project["files"].items():
        result.append({
            "file_path": fname,
            "lines": info["lines"],
            "migrated": info.get("migrated", False),
        })
    return result


def get_file_content(project_id: str, file_path: str, version: str = "original") -> dict:
    """Get file content for a given version (original or migrated)."""
    project = _projects.get(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    subdir = "migrated" if version == "migrated" else "source"
    full_path = _safe_path(project_id, subdir, file_path)

    if not os.path.exists(full_path):
        raise ValueError(f"File {file_path} ({version}) not found")

    with open(full_path) as f:
        content = f.read()

    return {
        "file_path": file_path,
        "version": version,
        "content": content,
        "lines": content.count("\n") + 1,
    }


def delete_project(project_id: str) -> dict:
    """Delete a project and clean up its files from disk."""
    project = _projects.get(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    # Remove files from disk
    project_path = _project_dir(project_id)
    if os.path.exists(project_path):
        shutil.rmtree(project_path)

    # Remove from in-memory store
    del _projects[project_id]

    return {"deleted": project_id, "status": "ok"}


# ── Helpers ──────────────────────────────────────────────────────────────


def _project_response(project: dict) -> ProjectResponse:
    total_lines = sum(f["lines"] for f in project["files"].values())
    migrated = sum(1 for f in project["files"].values() if f.get("migrated"))
    dead_lines = project["analysis"].dead_code_lines if project.get("analysis") else 0

    return ProjectResponse(
        id=project["id"],
        name=project["name"],
        description=project["description"],
        source_language=project["source_language"],
        target_language=project["target_language"],
        status=project["status"],
        created_at=project["created_at"],
        file_count=len(project["files"]),
        total_lines=total_lines,
        dead_code_lines=dead_lines,
        migrated_files=migrated,
    )


def _build_summary(total_files: int, total_lines: int, dead_lines: int, risks) -> str:
    risk_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for r in risks:
        risk_counts[r.risk_level.value] += 1

    return (
        f"Project has {total_files} files with {total_lines:,} total lines. "
        f"{dead_lines:,} lines ({round(dead_lines/max(total_lines,1)*100,1)}%) detected as dead code — "
        f"recommended for removal before migration. "
        f"Risk distribution: {risk_counts['critical']} critical, {risk_counts['high']} high, "
        f"{risk_counts['medium']} medium, {risk_counts['low']} low risk files."
    )


def _overall_tier(transforms: list[Transformation]) -> ConfidenceTier:
    if not transforms:
        return ConfidenceTier.TIER_1_AUTO
    # Worst tier wins
    tier_order = [ConfidenceTier.TIER_4_MANUAL, ConfidenceTier.TIER_3_REVIEW,
                  ConfidenceTier.TIER_2_SPOT, ConfidenceTier.TIER_1_AUTO]
    for tier in tier_order:
        if any(t.confidence_tier == tier for t in transforms):
            return tier
    return ConfidenceTier.TIER_1_AUTO


def _apply_transformations(source: str, transforms: list[Transformation]) -> str:
    """Apply deterministic transformations to source code."""
    lines = source.splitlines()
    # Sort by line number descending so indices remain valid
    sorted_transforms = sorted(transforms, key=lambda t: t.line_start, reverse=True)

    # FIX 3: Handle multiline spans (line_start != line_end)
    for t in sorted_transforms:
        if 1 <= t.line_start <= len(lines):
            start_idx = t.line_start - 1
            end_idx = min(t.line_end, len(lines))
            original_line = lines[start_idx]
            indent = len(original_line) - len(original_line.lstrip())
            new_lines = [" " * indent + l for l in t.transformed_code.splitlines()]
            lines[start_idx:end_idx] = new_lines

    return "\n".join(lines) + "\n"
