# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Reforge AI

AI-powered legacy code migration platform (Python 2 → Python 3, Java 8 → Java 17). Covers the **full migration lifecycle**: pre-migration intelligence → confidence-tiered transformations → behavioral snapshot tests → incremental migration planning → dashboard.

## Build & Run

```bash
# Setup
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload --port 8000

# For LLM-powered semantic analysis, set:
export ANTHROPIC_API_KEY=your_key
```

Swagger docs at http://localhost:8000/docs after starting.

## Architecture

```
app/
├── main.py                          # FastAPI app entry point
├── api/routes.py                    # All API endpoints
├── core/config.py                   # Settings (env vars, model config)
├── models/schemas.py                # All Pydantic models (request/response/domain)
├── services/
│   ├── project_manager.py           # Orchestrator — coordinates the full migration lifecycle
│   ├── transformer.py               # Hybrid transformation engine (AST rules + LLM)
│   ├── test_generator.py            # Behavioral snapshot test generation
│   └── analyzers/
│       ├── dead_code.py             # AST-based dead code detection
│       ├── dependency_graph.py      # Import graph + topological migration ordering
│       └── risk_assessor.py         # Risk scoring with Py2 pattern detection
sample_legacy/                       # Demo Python 2 codebase for testing
```

### Key design decisions

- **Hybrid transformation**: Deterministic AST regex rules handle Tier 1 (syntax) changes at 0.95 confidence. LLM handles Tier 2-4 (semantic) changes. Each transformation carries a confidence tier and reasoning.
- **Confidence tiers**: Tier 1 (auto-apply, ≥0.9), Tier 2 (spot-check, ≥0.7), Tier 3 (review required, ≥0.4), Tier 4 (manual only, <0.4).
- **Migration order**: Dependency graph is topologically sorted — leaf modules migrate first to minimize breakage.
- **In-memory store**: `project_manager.py` uses `_projects` dict. Swap for a DB in production.
- **Deterministic rules** live in `DETERMINISTIC_RULES` list in `transformer.py`. Add new Py2→Py3 patterns there.

### API flow

1. `POST /api/v1/projects` — create project
2. `POST /api/v1/projects/{id}/files` — upload Python 2 files (multipart)
3. `POST /api/v1/projects/{id}/analyze` — run dead code + dependency + risk analysis
4. `POST /api/v1/projects/{id}/transform/{file}` — transform a single file
5. `POST /api/v1/projects/{id}/transform-batch` — transform all files in dependency order
6. `GET /api/v1/projects/{id}/dashboard` — migration progress dashboard
