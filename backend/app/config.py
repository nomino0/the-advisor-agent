"""CloudWise AI — Configuration management."""
from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path
import os

# Find .env file: check current dir, then parent dir (for running from backend/)
_env_file = ".env"
_parent_env = Path(__file__).resolve().parent.parent.parent / ".env"
if _parent_env.exists():
    _env_file = str(_parent_env)


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    This class provides sensible development defaults but enforces that
    critical secrets and URLs must be supplied via environment variables
    when `app_env` == "production".
    """

    # General
    app_env: str = "production"
    debug: bool = False
    secret_key: str | None = None

    # Backend
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_cors_origins: List[str] = []

    # Database
    postgres_user: str | None = None
    postgres_password: str | None = None
    postgres_db: str | None = None
    postgres_host: str | None = None
    postgres_port: int | None = None
    database_url: str | None = None

    # Redis
    redis_host: str | None = None
    redis_port: int | None = None
    redis_url: str | None = None

    # JWT
    jwt_secret_key: str | None = None
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # LLM
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    groq_api_key: str | None = None
    llm_mock_mode: bool = True

    # CAPTCHA / Bot protection
    # Supported values: "recaptcha" or "turnstile" (case-insensitive). If empty and debug=True,
    # verification will be skipped for local development.
    captcha_provider: str | None = None
    recaptcha_secret_key: str | None = None
    turnstile_secret_key: str | None = None

    # Email / Frontend
    frontend_url: str | None = None  # e.g. https://app.example.com
    sendgrid_api_key: str | None = None
    email_from: str | None = None  # e.g. "no-reply@example.com"

    # Stripe
    stripe_secret_key: str | None = None
    stripe_publishable_key: str | None = None
    stripe_webhook_secret: str | None = None

    # GitHub OAuth
    github_client_id: str | None = None
    github_client_secret: str | None = None
    github_redirect_uri: str = "http://localhost:8000/api/v1/auth/github/callback"

    # ChromaDB
    chroma_host: str = "chromadb"
    chroma_port: int = 8002

    def __init__(self, **values):
        super().__init__(**values)

        # Support two env var names for origins: CORS_ORIGINS (comma-separated)
        # or BACKEND_CORS_ORIGINS (JSON list or comma-separated).
        cors_env = os.getenv("CORS_ORIGINS") or os.getenv("BACKEND_CORS_ORIGINS")
        if cors_env:
            cors_env = cors_env.strip()
            if cors_env.startswith("["):
                try:
                    import json

                    parsed = json.loads(cors_env)
                    self.backend_cors_origins = [str(x) for x in parsed]
                except Exception:
                    self.backend_cors_origins = []
            else:
                self.backend_cors_origins = [o.strip() for o in cors_env.split(",") if o.strip()]

        # In production we must not rely on defaults for secrets or DB URL
        if str(self.app_env).lower() == "production":
            missing: list[str] = []
            if not self.secret_key:
                missing.append("SECRET_KEY")
            if not self.jwt_secret_key:
                missing.append("JWT_SECRET_KEY")
            if not self.database_url:
                missing.append("DATABASE_URL")
            if missing:
                raise RuntimeError(
                    "Missing required environment variables for production: " + ", ".join(missing)
                )

    @property
    def sync_database_url(self) -> str | None:
        """Sync database URL for Alembic migrations (safe to call only if set)."""
        if not self.database_url:
            return None
        return self.database_url.replace("+asyncpg", "")

    class Config:
        env_file = _env_file
        case_sensitive = False
        extra = "ignore"


settings = Settings()
