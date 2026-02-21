# Reforge AI

AI-powered legacy code migration platform. Covers the full migration lifecycle: pre-migration intelligence, confidence-tiered transformations, behavioral snapshot tests, incremental migration planning, and a real-time dashboard.

Currently supports **Python 2 → Python 3** and **Java 8 → Java 17** migration paths.

![Reforge AI](frontend/public/reforge-logo.png)

## Features

- **Dead code detection** — AST-based analysis finds unused functions, classes, and variables
- **Dependency graph** — import graph with topological sorting for safe migration ordering
- **Risk assessment** — per-file risk scoring based on Python 2 pattern density
- **Hybrid transformation** — deterministic AST rules (Tier 1) + LLM-powered semantic transforms (Tier 2-4)
- **Confidence tiers** — each transformation carries a confidence score and reasoning
- **Snapshot tests** — auto-generated behavioral tests to verify migration correctness
- **Run migrated code** — execute transformed files and inspect output inline
- **Batch migration** — transform all files in dependency order with one click
- **Migration dashboard** — real-time progress charts, risk breakdowns, and export to PDF
- **Slack integration** — send migration reports to Slack channels
- **AI assistant** — context-aware chat with persistent conversation history
- **GitHub import** — coming soon

## Tech Stack

**Backend:** Python 3, FastAPI, Pydantic, uvicorn
**Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Recharts
**AI:** Anthropic Claude API (for semantic transformations)

## Quick Start

### Local Development

```bash
# Backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..

# Optional: enable LLM-powered semantic analysis
export ANTHROPIC_API_KEY=your_key

# Run backend (port 8000)
uvicorn app.main:app --reload --port 8000

# Run frontend (port 5173)
cd frontend && npm run dev
```

Backend API docs at http://localhost:8000/docs
Frontend at http://localhost:5173

### Docker

```bash
docker build -t reforge-ai .
docker run -p 8000:8000 -e ANTHROPIC_API_KEY=your_key reforge-ai
```

Single container serves both the API and the built frontend at http://localhost:8000

### Deploy to Railway

1. Push this repo to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repo — Railway auto-detects the Dockerfile
4. Add environment variable: `ANTHROPIC_API_KEY` (optional, for LLM transforms)
5. Deploy — the app will be live at your Railway-provided URL

## Architecture

```
app/
├── main.py                          # FastAPI entry point + static file serving
├── api/routes.py                    # All API endpoints
├── core/config.py                   # Settings (env vars, model config)
├── models/schemas.py                # Pydantic models (request/response/domain)
├── services/
│   ├── project_manager.py           # Orchestrator — coordinates the full migration lifecycle
│   ├── transformer.py               # Hybrid transformation engine (AST rules + LLM)
│   ├── test_generator.py            # Behavioral snapshot test generation
│   ├── code_executor.py             # Sandboxed code execution
│   ├── slack_reporter.py            # Slack webhook integration
│   └── analyzers/
│       ├── dead_code.py             # AST-based dead code detection
│       ├── dependency_graph.py      # Import graph + topological migration ordering
│       └── risk_assessor.py         # Risk scoring with Py2 pattern detection
frontend/                            # React SPA (Vite + TypeScript + Tailwind)
sample_legacy/                       # Python 2 sample files for testing
```

## API Flow

1. `POST /api/v1/projects` — create a migration project
2. `POST /api/v1/projects/{id}/files` — upload source files (`.py` or `.java`)
3. `POST /api/v1/projects/{id}/analyze` — run dead code, dependency, and risk analysis
4. `POST /api/v1/projects/{id}/transform/{file}` — transform a single file
5. `POST /api/v1/projects/{id}/transform-batch` — transform all files in dependency order
6. `POST /api/v1/projects/{id}/run/{file}` — execute the migrated file
7. `GET /api/v1/projects/{id}/dashboard` — migration progress and metrics

## Sample Files

The `sample_legacy/` directory contains Python 2 files sourced from the [ancient-pythons](https://github.com/asottile-archive/ancient-pythons) archive — real Python 2.0 code with print statements, string exceptions, `has_key()`, `apply()`, and old-style classes.

## License

MIT
