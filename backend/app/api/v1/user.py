"""User endpoints — profile management and OAuth connections."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.user_connection import UserConnection
from app.schemas.auth import UserResponse
from app.services.audit_service import record_audit

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)


class ConnectionResponse(BaseModel):
    id: str
    provider: str
    provider_username: Optional[str]
    scope: Optional[str]
    created_at: str


class AddConnectionRequest(BaseModel):
    """Add an OAuth connection (MVP mock — in production the OAuth flow
    handles token exchange automatically)."""
    provider: str = Field(..., pattern="^(github|gitlab|google_drive)$")
    access_token: Optional[str] = None
    provider_username: Optional[str] = None


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("/profile", response_model=UserResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's profile."""
    from sqlalchemy import select as sa_select
    from app.models.user_connection import UserConnection
    gh_result = await db.execute(
        sa_select(UserConnection).where(
            UserConnection.user_id == current_user.id,
            UserConnection.provider == "github",
        )
    )
    github_connected = gh_result.scalar_one_or_none() is not None
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value if isinstance(current_user.role, UserRole) else current_user.role,
        is_active=current_user.is_active,
        totp_enabled=current_user.totp_enabled,
        github_connected=github_connected,
        created_at=current_user.created_at.isoformat(),
    )


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    body: UpdateProfileRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile."""
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.email is not None and body.email != current_user.email:
        # Check if email already taken
        existing = await db.execute(select(User).where(User.email == body.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already in use")
        current_user.email = body.email
    await db.flush()

    await record_audit(
        db, action="user.profile_update", user_id=current_user.id,
        resource="user", details="Profile updated",
        ip_address=_get_client_ip(request),
    )

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value if isinstance(current_user.role, UserRole) else current_user.role,
        is_active=current_user.is_active,
        totp_enabled=current_user.totp_enabled,
        created_at=current_user.created_at.isoformat(),
    )


# ---------- User Connections (GitHub / GitLab / Google Drive) ----------

@router.get("/connections", response_model=List[ConnectionResponse])
async def list_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the user's OAuth connections (GitHub, GitLab, Google Drive)."""
    result = await db.execute(
        select(UserConnection).where(UserConnection.user_id == current_user.id)
    )
    connections = result.scalars().all()
    return [
        ConnectionResponse(
            id=str(c.id),
            provider=c.provider,
            provider_username=c.provider_username,
            scope=c.scope,
            created_at=c.created_at.isoformat(),
        )
        for c in connections
    ]


@router.post("/connections", response_model=ConnectionResponse, status_code=201)
async def add_connection(
    body: AddConnectionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new provider connection (MVP mock — in production this is handled
    by the OAuth callback after the user authorises the app)."""
    # Check if connection already exists for this provider
    existing = await db.execute(
        select(UserConnection).where(
            UserConnection.user_id == current_user.id,
            UserConnection.provider == body.provider,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"{body.provider} already connected")

    conn = UserConnection(
        user_id=current_user.id,
        provider=body.provider,
        access_token_enc=body.access_token or "mock_token",  # encrypted in prod
        provider_username=body.provider_username,
        scope="read:repo" if body.provider in ("github", "gitlab") else "drive.readonly",
    )
    db.add(conn)
    await db.flush()
    await db.refresh(conn)

    await record_audit(
        db, action="user.connection_add", user_id=current_user.id,
        resource="connections", details=f"Connected {body.provider}",
        ip_address=_get_client_ip(request),
    )

    return ConnectionResponse(
        id=str(conn.id),
        provider=conn.provider,
        provider_username=conn.provider_username,
        scope=conn.scope,
        created_at=conn.created_at.isoformat(),
    )


@router.delete("/connections/{connection_id}")
async def remove_connection(
    connection_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an OAuth connection."""
    result = await db.execute(
        select(UserConnection).where(
            UserConnection.id == connection_id,
            UserConnection.user_id == current_user.id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    provider = conn.provider
    await db.delete(conn)
    await db.flush()

    await record_audit(
        db, action="user.connection_remove", user_id=current_user.id,
        resource="connections", details=f"Disconnected {provider}",
        ip_address=_get_client_ip(request),
    )

    return {"message": f"{provider} disconnected successfully"}
