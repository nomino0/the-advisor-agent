"""Health check endpoints — basic, readiness, liveness."""
from fastapi import APIRouter
from datetime import datetime, timezone
import platform

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check."""
    return {
        "status": "healthy",
        "service": "CloudWise AI Backend",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/ready")
async def readiness_check():
    """Readiness probe — checks that DB is reachable."""
    from app.db.session import engine
    try:
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    status = "ready" if db_ok else "not_ready"
    code = 200 if db_ok else 503
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content={"status": status, "database": "ok" if db_ok else "unreachable"},
        status_code=code,
    )


@router.get("/health/live")
async def liveness_check():
    """Liveness probe — always responds if process is running."""
    return {
        "status": "alive",
        "uptime_platform": platform.platform(),
        "python": platform.python_version(),
    }
