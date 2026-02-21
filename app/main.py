"""CodeShift AI — AI-powered legacy code migration platform.

End-to-end migration lifecycle: pre-migration intelligence,
confidence-tiered transformations, behavioral snapshot tests,
incremental migration planning, and a real-time dashboard.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    # FIX 11: Removed allow_credentials=True — invalid with wildcard origins
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "api": "/api/v1",
    }
