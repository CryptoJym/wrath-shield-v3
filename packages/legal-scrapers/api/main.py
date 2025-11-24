"""
Legal Advocate AI - FastAPI Backend
Main application entry point
"""

import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from api.middleware import setup_middleware
from api.routes import deadlines, requests, alerts, cases, completions, calendar
from utils.monitoring import HealthCheck, metrics
from utils.logging_config import setup_logging

# Setup logging
setup_logging(level="INFO")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    Handles startup and shutdown events
    """
    # Startup
    logger.info("Starting Legal Advocate AI API...")

    # Verify database connection (Alembic handles schema creation)
    try:
        from models.database import get_engine
        from sqlalchemy import text
        engine = get_engine()
        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(f"✅ Database connected: {engine.url}")
        logger.info("Database schema managed by Alembic migrations")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}", exc_info=True)
        raise

    yield

    # Shutdown
    logger.info("Shutting down Legal Advocate AI API...")


# Create FastAPI application
app = FastAPI(
    title="Legal Advocate AI API",
    description="RESTful API for managing legal deadlines, requests, and alerts",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Setup middleware
setup_middleware(app)

# Include routers
app.include_router(deadlines.router)
app.include_router(requests.router)
app.include_router(alerts.router)
app.include_router(cases.router)
app.include_router(completions.router)
app.include_router(calendar.router)


# Health check endpoint
@app.get("/health", tags=["system"])
async def health_check():
    """
    Health check endpoint

    Returns system health status and basic metrics.
    Used by monitoring systems and load balancers.
    """
    health = HealthCheck.check_system_health()
    return JSONResponse(content=health)


# Metrics endpoint
@app.get("/metrics", tags=["system"])
async def get_metrics():
    """
    Metrics endpoint

    Returns comprehensive system metrics including:
    - Performance metrics for all operations
    - Error rates and summaries
    - Counter and gauge metrics
    - Overall system health

    Useful for monitoring dashboards and alerting systems.
    """
    metrics_report = HealthCheck.get_metrics_report()
    return JSONResponse(content=metrics_report)


# Root endpoint
@app.get("/", tags=["system"])
async def root():
    """
    Root endpoint

    Returns API information and available endpoints.
    """
    return {
        "name": "Legal Advocate AI API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/health",
            "metrics": "/metrics",
            "deadlines": "/api/deadlines",
            "requests": "/api/requests",
            "alerts": "/api/alerts",
            "cases": "/api/cases",
            "completions": "/api/completions",
            "calendar": "/api/calendar"
        }
    }


# Custom exception handlers (in addition to middleware)
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Handle 404 errors"""
    return JSONResponse(
        status_code=404,
        content={
            "error": "NotFound",
            "message": f"Endpoint {request.url.path} not found",
            "details": None
        }
    )


@app.exception_handler(405)
async def method_not_allowed_handler(request: Request, exc):
    """Handle 405 errors"""
    return JSONResponse(
        status_code=405,
        content={
            "error": "MethodNotAllowed",
            "message": f"Method {request.method} not allowed for {request.url.path}",
            "details": None
        }
    )


# Development server runner
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
