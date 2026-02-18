"""Subscription endpoints — plan management (mock Stripe Billing for MVP)."""
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional

from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.subscription import Subscription
from app.services.audit_service import record_audit

router = APIRouter()

# Plan definitions per Section 4
PLANS = {
    "free": {"name": "Free", "price_cents": 0, "analyses_limit": 3, "features": ["3 analyses/month", "Basic report"]},
    "starter": {"name": "Starter", "price_cents": 1900, "analyses_limit": 15, "features": ["15 analyses/month", "Full reports", "PDF export"]},
    "pro": {"name": "Pro", "price_cents": 4900, "analyses_limit": 50, "features": ["50 analyses/month", "Full reports", "PDF export", "Priority processing"]},
    "team": {"name": "Team", "price_cents": 14900, "analyses_limit": 200, "features": ["200 analyses/month", "Team sharing", "Admin dashboard", "Priority support"]},
    "enterprise": {"name": "Enterprise", "price_cents": 0, "analyses_limit": 999999, "features": ["Unlimited analyses", "Dedicated support", "Custom integrations", "SLA"]},
}


class CreateSubscriptionRequest(BaseModel):
    plan: str = Field(..., pattern="^(free|starter|pro|team|enterprise)$")


class UpdateSubscriptionRequest(BaseModel):
    plan: str = Field(..., pattern="^(free|starter|pro|team|enterprise)$")


class SubscriptionResponse(BaseModel):
    id: str
    plan: str
    status: str
    analyses_used: int
    analyses_limit: int
    current_period_start: Optional[str]
    current_period_end: Optional[str]
    cancel_at_period_end: bool


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("/plans")
async def list_plans():
    """List available subscription plans."""
    return {"plans": PLANS}


@router.post("/create", response_model=SubscriptionResponse, status_code=201)
async def create_subscription(
    body: CreateSubscriptionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new subscription (mock Stripe Billing for MVP)."""
    # Check if user already has a subscription
    existing = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User already has a subscription. Use PUT to upgrade/downgrade.")

    plan_info = PLANS[body.plan]
    now = datetime.utcnow()

    sub = Subscription(
        user_id=current_user.id,
        stripe_sub_id=f"sub_mock_{uuid.uuid4().hex[:16]}",
        plan=body.plan,
        status="active",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        analyses_used=0,
        analyses_limit=plan_info["analyses_limit"],
    )
    db.add(sub)
    await db.flush()
    await db.refresh(sub)

    await record_audit(
        db, action="subscription.create", user_id=current_user.id,
        resource=f"subscription:{sub.id}",
        details=f"Created {body.plan} subscription",
        ip_address=_get_client_ip(request),
    )

    return _to_response(sub)


@router.get("/current", response_model=SubscriptionResponse)
async def get_current_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the user's current subscription and usage."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        # Return default free tier
        return SubscriptionResponse(
            id="free",
            plan="free",
            status="active",
            analyses_used=0,
            analyses_limit=3,
            current_period_start=None,
            current_period_end=None,
            cancel_at_period_end=False,
        )
    return _to_response(sub)


@router.put("/update", response_model=SubscriptionResponse)
async def update_subscription(
    body: UpdateSubscriptionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upgrade or downgrade subscription plan."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription. Create one first.")

    plan_info = PLANS[body.plan]
    sub.plan = body.plan
    sub.analyses_limit = plan_info["analyses_limit"]
    await db.flush()

    await record_audit(
        db, action="subscription.update", user_id=current_user.id,
        resource=f"subscription:{sub.id}",
        details=f"Changed plan to {body.plan}",
        ip_address=_get_client_ip(request),
    )

    return _to_response(sub)


@router.delete("/cancel")
async def cancel_subscription(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel subscription at end of billing period."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription")

    sub.cancel_at_period_end = True
    await db.flush()

    await record_audit(
        db, action="subscription.cancel", user_id=current_user.id,
        resource=f"subscription:{sub.id}",
        details="Subscription cancellation scheduled",
        ip_address=_get_client_ip(request),
    )

    return {"message": "Subscription will be cancelled at end of billing period"}


@router.get("/usage")
async def get_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get analysis usage for the current billing period."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return {"plan": "free", "analyses_used": 0, "analyses_limit": 3, "remaining": 3}

    return {
        "plan": sub.plan,
        "analyses_used": sub.analyses_used,
        "analyses_limit": sub.analyses_limit,
        "remaining": max(0, sub.analyses_limit - sub.analyses_used),
        "period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
        "period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
    }


def _to_response(sub: Subscription) -> SubscriptionResponse:
    return SubscriptionResponse(
        id=str(sub.id),
        plan=sub.plan,
        status=sub.status,
        analyses_used=sub.analyses_used,
        analyses_limit=sub.analyses_limit,
        current_period_start=sub.current_period_start.isoformat() if sub.current_period_start else None,
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
        cancel_at_period_end=sub.cancel_at_period_end,
    )
