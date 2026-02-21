"""Reforge AI — AI-powered legacy code migration platform.

End-to-end migration lifecycle: pre-migration intelligence,
confidence-tiered transformations, behavioral snapshot tests,
incremental migration planning, and a real-time dashboard.
"""

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=settings.description,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes first — these take priority over static files
app.include_router(router, prefix="/api/v1")

# Serve frontend static files in production
STATIC_DIR = Path(os.environ.get("STATIC_DIR", "frontend/dist"))

if STATIC_DIR.is_dir():
    # Serve static assets (JS, CSS, images, etc.)
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    # Serve files from public dir (logo, favicon, etc.)
    @app.get("/reforge-logo.png")
    async def serve_logo():
        logo = STATIC_DIR / "reforge-logo.png"
        if logo.exists():
            return FileResponse(logo)
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/vite.svg")
    async def serve_vite_svg():
        svg = STATIC_DIR / "vite.svg"
        if svg.exists():
            return FileResponse(svg)
        return FileResponse(STATIC_DIR / "index.html")

    # SPA catch-all: serve index.html for all non-API, non-asset routes
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # If a real file exists in dist, serve it
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        # Otherwise serve index.html for client-side routing
        return FileResponse(STATIC_DIR / "index.html")
