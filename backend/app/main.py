"""NEXUSNET FastAPI Application Main Entrypoint.

Starts the FastAPI server with lifespan database initialization, automatic seeding,
CORS middleware, centralized error handling, and API routing.
"""
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import APIRouter, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select

from backend.app.db import SessionLocal, init_db
from backend.app.manage_users import seed_demo_users_if_empty
from backend.app.models import Reading
from backend.app.routes import (
    analytics,
    assets,
    auth,
    health,
    incidents,
    ingest,
    predict,
    stats,
    streaming,
    topology,
)
from backend.app.seed import seed_database
from backend.app.seed_topology import seed_topology_links_if_empty
from backend.app.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event to initialize database schema and seed if empty on startup."""
    init_db()
    with SessionLocal() as db:
        reading_count = db.scalar(select(func.count(Reading.id))) or 0
        if reading_count == 0:
            print("[STARTUP] Database is empty. Running initial seeding...")
            seed_database(db)
        else:
            print(f"[STARTUP] Database already initialized with {reading_count} readings.")
    seed_demo_users_if_empty()
    seed_topology_links_if_empty()
    yield


app = FastAPI(
    title="NEXUSNET NOC Backend API",
    description="AI-Powered Telecom Network Intelligence & Incident Monitoring System",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Centralized Exception Handlers with uniform format: {detail, code, errors[]}
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        content = {
            "detail": exc.detail.get("detail", "An error occurred"),
            "code": exc.detail.get("code", "HTTP_ERROR"),
            "errors": exc.detail.get("errors", []),
        }
    else:
        content = {
            "detail": str(exc.detail),
            "code": "HTTP_ERROR",
            "errors": [str(exc.detail)],
        }
    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    error_list = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "Validation error")
        error_list.append(f"{loc}: {msg}")

    content = {
        "detail": "Request payload validation failed",
        "code": "VALIDATION_ERROR",
        "errors": error_list,
    }
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=content)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    content = {
        "detail": "Internal server error occurred",
        "code": "INTERNAL_SERVER_ERROR",
        "errors": [str(exc)],
    }
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=content)


# Aggregate all routes under prefix /api
api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(predict.router)
api_router.include_router(ingest.router)
api_router.include_router(assets.router)
api_router.include_router(stats.router)
api_router.include_router(analytics.router)
api_router.include_router(incidents.router)
api_router.include_router(auth.router)
api_router.include_router(topology.router)
api_router.include_router(streaming.router)

app.include_router(api_router)


@app.get("/")
def root_redirect():
    """Root redirect to interactive API documentation."""
    return {"message": "NEXUSNET Telecom Intelligence API", "docs": "/docs", "health": "/api/health"}
