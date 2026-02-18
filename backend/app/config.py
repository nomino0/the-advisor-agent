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
    """Application settings loaded from environment variables."""

    # General
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-me"

    # Backend
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Database
    postgres_user: str = "cloudwise"
    postgres_password: str = "cloudwise_secret"
    postgres_db: str = "cloudwise_db"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    database_url: str = "postgresql+asyncpg://cloudwise:cloudwise_secret@localhost:5432/cloudwise_db"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "change-me-jwt"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # LLM
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    llm_mock_mode: bool = True

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/api/v1/auth/github/callback"

    # ChromaDB
    chroma_host: str = "chromadb"
    chroma_port: int = 8002

    @property
    def sync_database_url(self) -> str:
        """Sync database URL for Alembic migrations."""
        return self.database_url.replace("+asyncpg", "")

    class Config:
        env_file = _env_file
        case_sensitive = False
        extra = "ignore"


settings = Settings()
