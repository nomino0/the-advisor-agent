"""Authentication Pydantic schemas."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TwoFactorLoginRequest(BaseModel):
    """Complete 2FA login with the pending token and TOTP code."""
    pending_token: str
    totp_code: str = Field(..., min_length=6, max_length=6)


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    totp_enabled: bool
    github_connected: bool = False
    created_at: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    requires_2fa: bool = False


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_code: str  # base64 PNG
    uri: str


class TwoFactorVerifyRequest(BaseModel):
    token: str = Field(..., min_length=6, max_length=6)


class MessageResponse(BaseModel):
    message: str
    success: bool = True
