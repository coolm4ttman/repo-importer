"""API routes for CodeShift AI."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.models.schemas import (
    AnalysisResponse,
    DashboardResponse,
    FileTransformationResponse,
    HealthResponse,
    MigrateBatchRequest,
    ProjectCreate,
    ProjectResponse,
)
from app.services.project_manager import (
    analyze_project,
    create_project,
    delete_project,
    export_project,
    get_dashboard,
    get_file_content,
    get_file_diff,
    get_project,
    list_files,
    list_projects,
    save_file,
    transform_file,
)

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        features=[
            "dead_code_detection",
            "dependency_graph_analysis",
            "risk_assessment",
            "confidence_tiered_transformation",
            "behavioral_snapshot_tests",
            "incremental_migration_planning",
            "migration_dashboard",
        ],
    )


# ── Project management ──────────────────────────────────────────────────


@router.post("/projects", response_model=ProjectResponse)
async def create_new_project(req: ProjectCreate):
    return create_project(req.name, req.description, req.source_language, req.target_language)


@router.get("/projects", response_model=list[ProjectResponse])
async def list_all_projects():
    return list_projects()


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project_detail(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


# ── File upload ──────────────────────────────────────────────────────────


@router.post("/projects/{project_id}/files")
async def upload_files(project_id: str, files: list[UploadFile] = File(...)):
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    results = []
    for file in files:
        # FIX 8: Validate file type
        if not file.filename or not file.filename.endswith('.py'):
            raise HTTPException(400, f"Only .py files are supported, got: {file.filename}")

        content = await file.read()

        # FIX 7: Enforce file size limit
        if len(content) > settings.max_file_size_mb * 1024 * 1024:
            raise HTTPException(413, f"File {file.filename} exceeds {settings.max_file_size_mb}MB limit")

        result = save_file(project_id, file.filename, content)
        results.append(result)

    return {"uploaded": len(results), "files": results}


# ── Analysis (pre-migration intelligence) ────────────────────────────────


@router.post("/projects/{project_id}/analyze", response_model=AnalysisResponse)
async def run_analysis(project_id: str):
    """Run full pre-migration analysis: dead code, dependencies, risk, migration plan."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    try:
        return analyze_project(project_id)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Transformation ───────────────────────────────────────────────────────


@router.post("/projects/{project_id}/transform/{file_path:path}", response_model=FileTransformationResponse)
async def transform_single_file(project_id: str, file_path: str):
    """Transform a single file with confidence-tiered changes and snapshot tests."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    try:
        return await transform_file(project_id, file_path)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/projects/{project_id}/transform-batch")
async def transform_batch(project_id: str, req: MigrateBatchRequest | None = None):
    """Transform multiple files in dependency order."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Get analysis for migration order
    dashboard = get_dashboard(project_id)
    if dashboard.migration_plan:
        file_order = [step.file_path for step in dashboard.migration_plan]
    else:
        file_order = list(req.file_paths) if req and req.file_paths else []

    if req and req.file_paths:
        file_order = [f for f in file_order if f in req.file_paths]

    results = []
    for fpath in file_order:
        try:
            result = await transform_file(project_id, fpath)
            results.append({
                "file_path": fpath,
                "status": "success",
                "transformations": len(result.transformations),
                "overall_confidence": result.overall_confidence,
                "overall_tier": result.overall_tier.value,
            })
        except Exception as e:
            results.append({
                "file_path": fpath,
                "status": "error",
                "error": str(e),
            })

    return {
        "project_id": project_id,
        "processed": len(results),
        "results": results,
    }


# ── Dashboard ────────────────────────────────────────────────────────────


@router.get("/projects/{project_id}/dashboard", response_model=DashboardResponse)
async def project_dashboard(project_id: str):
    """Get migration dashboard with progress, risks, and blockers."""
    try:
        return get_dashboard(project_id)
    except ValueError:
        raise HTTPException(404, "Project not found")


# ── File operations ───────────────────────────────────────────────────────


@router.get("/projects/{project_id}/diff/{file_path:path}")
async def file_diff(project_id: str, file_path: str):
    """Return unified diff between original and migrated file with confidence annotations."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    try:
        return get_file_diff(project_id, file_path)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/projects/{project_id}/export")
async def export_project_zip(project_id: str):
    """Export migrated source, tests, and migration report as a ZIP file."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    try:
        buf = export_project(project_id)
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={project_id}_export.zip"},
        )
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/projects/{project_id}/files")
async def list_project_files(project_id: str):
    """List all uploaded files with line counts and migration status."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    try:
        return {"project_id": project_id, "files": list_files(project_id)}
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/projects/{project_id}/files/{file_path:path}")
async def get_project_file_content(
    project_id: str,
    file_path: str,
    version: str = Query("original", pattern="^(original|migrated)$"),
):
    """Get file content. Use ?version=original or ?version=migrated."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    try:
        return get_file_content(project_id, file_path, version)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("/projects/{project_id}")
async def delete_project_endpoint(project_id: str):
    """Delete a project and clean up its files from disk."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    try:
        return delete_project(project_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
