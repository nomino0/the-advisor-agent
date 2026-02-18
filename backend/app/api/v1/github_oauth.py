"""GitHub OAuth2 flow — connect a GitHub account to access private repos.

Endpoints:
  GET  /auth/github          → Redirect user to GitHub authorization page
  GET  /auth/github/callback  → Handle callback, exchange code for token, save connection
  GET  /auth/github/status    → Check if user has GitHub connected

Flow:
  1. Frontend calls GET /api/v1/auth/github → gets redirect URL
  2. User authorises on GitHub
  3. GitHub redirects back to /api/v1/auth/github/callback?code=XXX&state=YYY
  4. Backend exchanges code → access_token, saves to user_connections
  5. Backend redirects user to frontend /settings?github=connected
"""

import logging
import secrets
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.user_connection import UserConnection
from app.services.audit_service import record_audit

logger = logging.getLogger("cloudwise.github_oauth")
router = APIRouter()

# In-memory state store (use Redis in production)
_oauth_states: dict = {}

# GitHub OAuth config — read from settings / env
GITHUB_CLIENT_ID = getattr(settings, "github_client_id", "") or ""
GITHUB_CLIENT_SECRET = getattr(settings, "github_client_secret", "") or ""
GITHUB_REDIRECT_URI = getattr(settings, "github_redirect_uri", "") or "http://localhost:8000/api/v1/auth/github/callback"
FRONTEND_URL = "http://localhost:3000"

GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ---------- GET /auth/github — Start OAuth flow ----------

@router.get("/github")
async def github_auth_redirect(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Generate GitHub OAuth authorization URL.

    The frontend can either:
      a) Redirect the browser to this URL, or
      b) Call this endpoint and open the returned `auth_url` in a popup/new tab.
    """
    if not GITHUB_CLIENT_ID:
        # Fallback: accept a Personal Access Token instead of OAuth
        raise HTTPException(
            status_code=501,
            detail="GitHub OAuth not configured. Use Personal Access Token flow instead.",
        )

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {
        "user_id": str(current_user.id),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": "repo read:user user:email",
        "state": state,
    }
    auth_url = f"{GITHUB_AUTH_URL}?{urlencode(params)}"

    return {"auth_url": auth_url, "state": state}


# ---------- GET /auth/github/callback — Handle OAuth callback ----------

@router.get("/github/callback")
async def github_auth_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle the GitHub OAuth callback after user authorises the app.

    Exchanges the authorization code for an access token and saves it.
    """
    # Validate state
    state_data = _oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    user_id = state_data["user_id"]

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )

    if resp.status_code != 200:
        logger.error("GitHub token exchange failed: %s", resp.text)
        raise HTTPException(status_code=502, detail="Failed to exchange GitHub token")

    token_data = resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        error = token_data.get("error_description", token_data.get("error", "Unknown"))
        raise HTTPException(status_code=502, detail=f"GitHub token error: {error}")

    scope = token_data.get("scope", "")
    token_type = token_data.get("token_type", "bearer")

    # Get GitHub user info
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            GITHUB_USER_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    github_username = "unknown"
    if user_resp.status_code == 200:
        github_data = user_resp.json()
        github_username = github_data.get("login", "unknown")

    # Save or update connection
    uid = uuid.UUID(user_id)
    existing = await db.execute(
        select(UserConnection).where(
            UserConnection.user_id == uid,
            UserConnection.provider == "github",
        )
    )
    conn = existing.scalar_one_or_none()

    if conn:
        conn.access_token_enc = access_token  # encrypt in production
        conn.scope = scope
        conn.provider_username = github_username
    else:
        conn = UserConnection(
            user_id=uid,
            provider="github",
            access_token_enc=access_token,  # encrypt in production
            scope=scope,
            provider_username=github_username,
        )
        db.add(conn)

    await db.flush()

    await record_audit(
        db, action="user.github_connected", user_id=uid,
        resource="connections",
        details=f"GitHub account connected: {github_username}",
        ip_address=_get_client_ip(request),
    )

    logger.info("GitHub OAuth complete for user %s (GitHub: %s)", user_id, github_username)

    # Redirect to frontend settings page
    return RedirectResponse(
        url=f"{FRONTEND_URL}/settings?github=connected&username={github_username}",
        status_code=302,
    )


# ---------- GET /auth/github/status — Check connection status ----------

@router.get("/github/status")
async def github_connection_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if the current user has a GitHub connection."""
    result = await db.execute(
        select(UserConnection).where(
            UserConnection.user_id == current_user.id,
            UserConnection.provider == "github",
        )
    )
    conn = result.scalar_one_or_none()

    if conn:
        return {
            "connected": True,
            "provider_username": conn.provider_username,
            "scope": conn.scope,
            "connected_at": conn.created_at.isoformat() if conn.created_at else None,
        }
    return {"connected": False}


# ---------- POST /auth/github/pat — Connect via Personal Access Token ----------

@router.post("/github/pat")
async def connect_github_pat(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Connect GitHub account using a Personal Access Token.

    This is the fallback when GitHub OAuth App is not configured.
    The user generates a fine-grained PAT on GitHub and provides it here.
    """
    body = await request.json()
    pat = body.get("token", "").strip()
    if not pat:
        raise HTTPException(status_code=400, detail="Token is required")

    # Validate the token by calling GitHub API
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GITHUB_USER_URL,
            headers={"Authorization": f"Bearer {pat}"},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid GitHub token — cannot authenticate")

    github_data = resp.json()
    github_username = github_data.get("login", "unknown")

    # Save or update connection
    existing = await db.execute(
        select(UserConnection).where(
            UserConnection.user_id == current_user.id,
            UserConnection.provider == "github",
        )
    )
    conn = existing.scalar_one_or_none()

    if conn:
        conn.access_token_enc = pat  # encrypt in production
        conn.provider_username = github_username
        conn.scope = "pat"
    else:
        conn = UserConnection(
            user_id=current_user.id,
            provider="github",
            access_token_enc=pat,
            provider_username=github_username,
            scope="pat",
        )
        db.add(conn)

    await db.flush()

    await record_audit(
        db, action="user.github_pat_connected", user_id=current_user.id,
        resource="connections",
        details=f"GitHub PAT connected: {github_username}",
        ip_address=_get_client_ip(request),
    )

    return {
        "connected": True,
        "provider_username": github_username,
        "message": f"GitHub account '{github_username}' connected successfully via PAT",
    }
