"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.user_connection import UserConnection
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    LoginResponse,
    TwoFactorLoginRequest,
    UserResponse,
    TwoFactorSetupResponse,
    TwoFactorVerifyRequest,
    MessageResponse,
    TokenRefreshRequest,
)
from app.security.password import hash_password, verify_password
from app.security.jwt import create_access_token, create_refresh_token, create_2fa_pending_token, decode_token
from app.security.totp import generate_totp_secret, get_totp_uri, generate_qr_code_base64, verify_totp
from app.api.dependencies import get_current_user
from app.services.audit_service import record_audit

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def _get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _user_response(user: User, github_connected: bool = False) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if isinstance(user.role, UserRole) else user.role,
        is_active=user.is_active,
        totp_enabled=user.totp_enabled,
        github_connected=github_connected,
        created_at=user.created_at.isoformat(),
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request_body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user."""
    result = await db.execute(select(User).where(User.email == request_body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=request_body.email,
        password_hash=hash_password(request_body.password),
        full_name=request_body.full_name,
        role=UserRole.USER,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await record_audit(
        db, action="user.register", user_id=user.id,
        resource="auth", details=f"New user registered: {user.email}",
        ip_address=_get_client_ip(request),
    )

    return _user_response(user)


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request_body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password. Returns tokens directly or requires 2FA."""
    result = await db.execute(select(User).where(User.email == request_body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request_body.password, user.password_hash):
        await record_audit(
            db, action="user.login_failed", resource="auth",
            details=f"Failed login attempt for: {request_body.email}",
            ip_address=_get_client_ip(request),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # Update last login (naive UTC to match TIMESTAMP WITHOUT TIME ZONE column)
    user.last_login = datetime.utcnow()

    # If 2FA is enabled, return a temporary pending token instead of full access
    if user.totp_enabled:
        pending_token = create_2fa_pending_token(
            {"sub": str(user.id), "email": user.email}
        )
        await record_audit(
            db, action="user.login_2fa_pending", user_id=user.id,
            resource="auth", details="Login succeeded, awaiting 2FA verification",
            ip_address=_get_client_ip(request),
        )
        return {
            "requires_2fa": True,
            "pending_token": pending_token,
            "message": "2FA verification required. Send TOTP code to /auth/2fa/login.",
        }

    # No 2FA — issue full tokens
    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value if isinstance(user.role, UserRole) else user.role}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    await record_audit(
        db, action="user.login", user_id=user.id,
        resource="auth", details="Login successful",
        ip_address=_get_client_ip(request),
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_response(user),
        requires_2fa=False,
    )


@router.post("/2fa/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login_2fa(
    request_body: TwoFactorLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Complete login by verifying TOTP code with a pending 2FA token."""
    payload = decode_token(request_body.pending_token)
    if not payload or payload.get("type") != "2fa_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired 2FA pending token",
        )

    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user or not user.totp_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not verify_totp(user.totp_secret, request_body.totp_code):
        await record_audit(
            db, action="user.2fa_failed", user_id=user.id,
            resource="auth", details="Invalid TOTP code during login",
            ip_address=_get_client_ip(request),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid TOTP code",
        )

    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value if isinstance(user.role, UserRole) else user.role}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    await record_audit(
        db, action="user.login_2fa_complete", user_id=user.id,
        resource="auth", details="2FA login completed successfully",
        ip_address=_get_client_ip(request),
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_response(user),
        requires_2fa=False,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Logout the current user. (Client should discard tokens.)"""
    await record_audit(
        db, action="user.logout", user_id=current_user.id,
        resource="auth", details="User logged out",
        ip_address=_get_client_ip(request),
    )
    return MessageResponse(message="Logged out successfully. Please discard your tokens.")


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(request_body: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh an access token."""
    payload = decode_token(request_body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value if isinstance(user.role, UserRole) else user.role}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_response(user),
        requires_2fa=False,
    )


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_2fa(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a TOTP secret and QR code for 2FA setup."""
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, current_user.email)
    qr_code = generate_qr_code_base64(uri)

    # Store the secret (unverified until user confirms)
    current_user.totp_secret = secret
    await db.flush()

    await record_audit(
        db, action="user.2fa_setup", user_id=current_user.id,
        resource="auth", details="2FA setup initiated",
        ip_address=_get_client_ip(request),
    )

    return TwoFactorSetupResponse(secret=secret, qr_code=qr_code, uri=uri)


@router.post("/2fa/verify", response_model=MessageResponse)
async def verify_2fa(
    request_body: TwoFactorVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify a TOTP token and enable 2FA."""
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA not set up. Call /2fa/setup first.",
        )

    if not verify_totp(current_user.totp_secret, request_body.token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP token",
        )

    current_user.totp_enabled = True
    await db.flush()

    await record_audit(
        db, action="user.2fa_enabled", user_id=current_user.id,
        resource="auth", details="2FA enabled successfully",
        ip_address=_get_client_ip(request),
    )

    return MessageResponse(message="2FA enabled successfully")


@router.post("/2fa/disable", response_model=MessageResponse)
async def disable_2fa(
    request_body: TwoFactorVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable 2FA. Requires a valid TOTP token to confirm identity."""
    if not current_user.totp_enabled or not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled on this account.",
        )

    if not verify_totp(current_user.totp_secret, request_body.token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP token. Cannot disable 2FA.",
        )

    current_user.totp_enabled = False
    current_user.totp_secret = None
    await db.flush()

    await record_audit(
        db, action="user.2fa_disabled", user_id=current_user.id,
        resource="auth", details="2FA disabled",
        ip_address=_get_client_ip(request),
    )

    return MessageResponse(message="2FA disabled successfully")


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile."""
    gh_result = await db.execute(
        select(UserConnection).where(
            UserConnection.user_id == current_user.id,
            UserConnection.provider == "github",
        )
    )
    github_connected = gh_result.scalar_one_or_none() is not None
    return _user_response(current_user, github_connected=github_connected)
