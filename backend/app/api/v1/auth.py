"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from app.core.rate_limit import limiter
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
    ResendVerificationRequest,
)
from app.security.password import hash_password, verify_password
from app.security.jwt import (
    create_access_token,
    create_refresh_token,
    create_2fa_pending_token,
    create_trusted_device_token,
    create_email_verification_token,
    decode_token,
)
from app.security.captcha import verify_captcha
import logging
from app.config import settings
from app.security.totp import generate_totp_secret, get_totp_uri, generate_qr_code_base64, verify_totp
from app.api.dependencies import get_current_user
from app.services.audit_service import record_audit

router = APIRouter()


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
        email_verified=getattr(user, "email_verified", False),
        totp_enabled=user.totp_enabled,
        github_connected=github_connected,
        created_at=user.created_at.isoformat(),
    )


from app.schemas.auth import RegisterResponse


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request_body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user."""
    # Verify captcha first
    if not await verify_captcha(request_body.captcha_token, _get_client_ip(request)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Captcha verification failed")
    result = await db.execute(select(User).where(User.email == request_body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Validate password strength
    from app.security.password import validate_password_strength

    ok, msg = validate_password_strength(request_body.password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    user = User(
        email=request_body.email,
        password_hash=hash_password(request_body.password),
        full_name=request_body.full_name,
        role=UserRole.USER,
        is_active=False,  # require email verification before activating
        email_verified=False,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await record_audit(
        db, action="user.register", user_id=user.id,
        resource="auth", details=f"New user registered: {user.email}",
        ip_address=_get_client_ip(request),
    )

    # Generate email verification token and send verification link (logged for now)
    email_sent = False
    verification_url = None
    try:
        token = create_email_verification_token({"sub": str(user.id), "email": user.email})
        # Build verification URL using configured frontend or backend fallback
        base = settings.frontend_url or f"{request.url.scheme}://{request.url.hostname}:{settings.backend_port}"
        verification_url = f"{base.rstrip('/')}/verify-email?token={token}"

        # Send email (best-effort). Falls back to logging if send fails.
        from app.emailer import send_verification_email

        sent = await send_verification_email(user.email, verification_url, subject="Verify your CloudWise AI account")
        logger = logging.getLogger(__name__)
        email_sent = bool(sent)
        if not sent:
            logger.info("Verification link for %s (send failed or not configured): %s", user.email, verification_url)

        await record_audit(
            db, action="user.register_email_sent", user_id=user.id,
            resource="auth", details="Sent email verification link (attempted)",
            ip_address=_get_client_ip(request),
        )
    except Exception:
        # Don't fail registration on email-send issues, but log.
        logger = logging.getLogger(__name__)
        logger.exception("Failed to generate/send email verification token for %s", user.email)

    return RegisterResponse(user=_user_response(user), email_sent=email_sent, verification_url=verification_url)


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request_body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password. Returns tokens directly or requires 2FA."""
    # Verify captcha first
    if not await verify_captcha(request_body.captcha_token, _get_client_ip(request)):
        await record_audit(
            db, action="user.login_captcha_failed", resource="auth",
            details=f"Captcha failed for: {request_body.email}", ip_address=_get_client_ip(request),
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Captcha verification failed")
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
            detail="Please activate your email first",
        )

    # Update last login (naive UTC to match TIMESTAMP WITHOUT TIME ZONE column)
    user.last_login = datetime.utcnow()

    # If 2FA is enabled, return a temporary pending token instead of full access
    if user.totp_enabled:
        # Check for trusted device token
        trusted_token = request.cookies.get("trusted_device_token")
        should_challenge = True
        
        if trusted_token:
            payload = decode_token(trusted_token)
            if payload and payload.get("type") == "trusted_device" and payload.get("sub") == str(user.id):
                should_challenge = False
                await record_audit(
                    db, action="user.login_trusted_device", user_id=user.id,
                    resource="auth", details="Skipped 2FA via trusted device token",
                    ip_address=_get_client_ip(request),
                )

        if should_challenge:
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

    # No 2FA or Trusted Device — issue full tokens
    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value if isinstance(user.role, UserRole) else user.role}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Set tokens as secure cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="Strict",
        max_age=1800
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="Strict",
        max_age=604800
    )

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
    response: Response,
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

    if request_body.trust_device:
        # Issue a trusted device token cookie (7 days)
        trusted_token = create_trusted_device_token(str(user.id))
        response.set_cookie(
            key="trusted_device_token",
            value=trusted_token,
            max_age=60 * 60 * 24 * 7,  # 7 days
            httponly=True,
            samesite="Lax",
            secure=True, # Always secure in prod
        )

    await record_audit(
        db, action="user.login_2fa_complete", user_id=user.id,
        resource="auth", details="2FA login completed successfully",
        ip_address=_get_client_ip(request),
    )

    # Set tokens as secure cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="Strict",
        max_age=1800
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="Strict",
        max_age=604800
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
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Logout the current user and aggressively clear cookies from the browser."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        payload = decode_token(auth_header.split(" ")[1])
        if payload and payload.get("sub"):
            try:
                await record_audit(
                    db, action="user.logout", user_id=payload.get("sub"),
                    resource="auth", details="User logged out",
                    ip_address=_get_client_ip(request),
                )
            except Exception:
                pass

    # Clear HttpOnly secure cookies
    response.delete_cookie(key="access_token", path="/", httponly=True, samesite="Strict", secure=True)
    response.delete_cookie(key="refresh_token", path="/", httponly=True, samesite="Strict", secure=True)
    # Also clear any plaintext fallback cookies just in case
    response.delete_cookie(key="access_token", path="/", secure=True)
    response.delete_cookie(key="user", path="/", secure=True)
    
    return MessageResponse(message="Logged out successfully. Please discard your tokens.")



@router.get("/verify-email", response_model=MessageResponse)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """Verify email using a short-lived token (query param `token`)."""
    payload = decode_token(token)
    if not payload or payload.get("type") != "email_verification":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.email_verified = True
    user.is_active = True
    await db.flush()

    await record_audit(
        db, action="user.email_verified", user_id=user.id,
        resource="auth", details="User verified email and activated account",
        ip_address="system",
    )

    return MessageResponse(message="Email verified successfully. You can now log in.")


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("3/hour")
async def resend_verification(
    request_body: "ResendVerificationRequest",
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Resend email verification link for a given email."""
    from app.schemas.auth import ResendVerificationRequest

    result = await db.execute(select(User).where(User.email == request_body.email))
    user = result.scalar_one_or_none()
    if not user:
        # Avoid leaking whether an email is registered
        return MessageResponse(message="If the email exists, a verification link was sent.")

    if user.email_verified:
        return MessageResponse(message="Email already verified.")

    try:
        token = create_email_verification_token({"sub": str(user.id), "email": user.email})
        base = settings.frontend_url or f"{request.url.scheme}://{request.url.hostname}:{settings.backend_port}"
        verification_url = f"{base.rstrip('/')}/verify-email?token={token}"
        from app.emailer import send_verification_email

        sent = await send_verification_email(user.email, verification_url, subject="Verify your CloudWise AI account")
        logger = logging.getLogger(__name__)
        if not sent:
            logger.info("Resent verification link for %s (send failed or not configured): %s", user.email, verification_url)

        await record_audit(
            db, action="user.resend_verification", user_id=user.id,
            resource="auth", details="Resent email verification link (attempted)",
            ip_address=_get_client_ip(request),
        )
    except Exception:
        logger = logging.getLogger(__name__)
        logger.exception("Failed to resend email verification for %s", user.email)

    return MessageResponse(message="If the email exists, a verification link was sent.")


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

    # Set tokens as secure cookies
    from fastapi import Response
    response = Response()
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="Strict",
        max_age=1800
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="Strict",
        max_age=604800
    )
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
