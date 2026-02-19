"""CloudWise AI — FastAPI application entry point."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import structlog
import logging

from app.config import settings
from app.core.rate_limit import limiter
from app.db.session import engine, Base
from app.api.v1 import auth, analysis, health, user, admin, payments, subscriptions, github_oauth, llm_config, knowledge_base

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

# Suppress verbose third-party logs
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)

file_logger = logging.getLogger("cloudwise")
logger = structlog.get_logger()

# Rate limiter is now imported from app.core.rate_limit to ensure single instance


# ── Security Headers Middleware (pure ASGI — avoids BaseHTTPMiddleware issues with CORS) ─
class SecurityHeadersMiddleware:
    """Add recommended security headers to every HTTP response.

    Implemented as a raw ASGI middleware instead of BaseHTTPMiddleware to
    prevent interference with CORSMiddleware preflight handling.
    """

    _EXTRA_HEADERS: list[tuple[bytes, bytes]] = [
        (b"x-content-type-options", b"nosniff"),
        (b"x-frame-options", b"DENY"),
        (b"x-xss-protection", b"1; mode=block"),
        (b"referrer-policy", b"strict-origin-when-cross-origin"),
        (b"permissions-policy", b"geolocation=(), microphone=()"),
        (b"cache-control", b"no-store"),
        (b"strict-transport-security", b"max-age=63072000; includeSubDomains; preload"),
    ]

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend(self._EXTRA_HEADERS)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info("Starting CloudWise AI Backend", env=settings.app_env)

    # Create tables on startup (dev only; use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified")

    yield

    logger.info("Shutting down CloudWise AI Backend")
    await engine.dispose()


app = FastAPI(
    title="CloudWise AI",
    description="Multi-Agent AI Cloud Optimization Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Security headers middleware  (added first → runs INNER)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SlowAPIMiddleware)

if settings.app_env.lower() == "production":
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.backend_cors_origins + ["api.cloudwise.ai", "localhost"])

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware  (added last → runs OUTER, so preflight OPTIONS are handled
# before any other middleware or routing logic touches the request)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(github_oauth.router, prefix="/api/v1/auth", tags=["GitHub OAuth"])
app.include_router(user.router, prefix="/api/v1/user", tags=["User"])
app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["Analysis"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["Payments"])
app.include_router(subscriptions.router, prefix="/api/v1/subscriptions", tags=["Subscriptions"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(llm_config.router, prefix="/api/v1/config/llm", tags=["LLM Configuration"])
app.include_router(knowledge_base.router, prefix="/api/v1/config/kb", tags=["Knowledge Base Configuration"])


@app.get("/")
async def root():
    return {
        "name": "CloudWise AI",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }
