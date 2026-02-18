"""Payment endpoints — Stripe-integrated payment flow (mock for MVP)."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from typing import Optional, List

from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.analysis import Analysis
from app.models.payment import Payment
from app.services.audit_service import record_audit

router = APIRouter()


class CreatePaymentIntentRequest(BaseModel):
    analysis_id: str
    currency: str = Field(default="usd", pattern="^(usd|eur|gbp)$")


class ConfirmPaymentRequest(BaseModel):
    payment_id: str
    stripe_payment_method: Optional[str] = None  # mock for MVP


class PaymentResponse(BaseModel):
    id: str
    analysis_id: Optional[str]
    amount_cents: int
    currency: str
    status: str
    receipt_url: Optional[str]
    created_at: str


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/create-intent", response_model=PaymentResponse)
async def create_payment_intent(
    body: CreatePaymentIntentRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a payment intent for a per-project analysis unlock.

    In production this calls Stripe's PaymentIntents API.  For MVP we
    create a mock payment record.
    """
    analysis_id = uuid.UUID(body.analysis_id)

    # Verify analysis belongs to user
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Pricing: $4.99 per project = 499 cents
    payment = Payment(
        user_id=current_user.id,
        analysis_id=analysis_id,
        amount_cents=499,
        currency=body.currency,
        status="pending",
        stripe_payment_id=f"pi_mock_{uuid.uuid4().hex[:16]}",
    )
    db.add(payment)
    await db.flush()
    await db.refresh(payment)

    await record_audit(
        db, action="payment.create_intent", user_id=current_user.id,
        resource=f"payment:{payment.id}",
        details=f"Payment intent created for analysis {analysis_id}",
        ip_address=_get_client_ip(request),
    )

    return PaymentResponse(
        id=str(payment.id),
        analysis_id=str(payment.analysis_id),
        amount_cents=payment.amount_cents,
        currency=payment.currency,
        status=payment.status,
        receipt_url=payment.receipt_url,
        created_at=payment.created_at.isoformat(),
    )


@router.post("/confirm", response_model=PaymentResponse)
async def confirm_payment(
    body: ConfirmPaymentRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm a payment and unlock the analysis report.

    In production this verifies the Stripe payment status.
    """
    payment_id = uuid.UUID(body.payment_id)
    result = await db.execute(
        select(Payment).where(
            Payment.id == payment_id,
            Payment.user_id == current_user.id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Mock: mark as succeeded
    payment.status = "succeeded"
    payment.receipt_url = f"https://pay.stripe.com/receipts/mock/{payment.stripe_payment_id}"

    # Unlock the analysis
    if payment.analysis_id:
        analysis_result = await db.execute(
            select(Analysis).where(Analysis.id == payment.analysis_id)
        )
        analysis = analysis_result.scalar_one_or_none()
        if analysis:
            analysis.is_unlocked = True

    await db.flush()

    await record_audit(
        db, action="payment.confirm", user_id=current_user.id,
        resource=f"payment:{payment.id}",
        details=f"Payment confirmed, analysis unlocked",
        ip_address=_get_client_ip(request),
    )

    return PaymentResponse(
        id=str(payment.id),
        analysis_id=str(payment.analysis_id) if payment.analysis_id else None,
        amount_cents=payment.amount_cents,
        currency=payment.currency,
        status=payment.status,
        receipt_url=payment.receipt_url,
        created_at=payment.created_at.isoformat(),
    )


@router.get("/history", response_model=List[PaymentResponse])
async def payment_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the user's payment history."""
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
    )
    payments = result.scalars().all()
    return [
        PaymentResponse(
            id=str(p.id),
            analysis_id=str(p.analysis_id) if p.analysis_id else None,
            amount_cents=p.amount_cents,
            currency=p.currency,
            status=p.status,
            receipt_url=p.receipt_url,
            created_at=p.created_at.isoformat(),
        )
        for p in payments
    ]


@router.get("/invoices")
async def list_invoices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user invoices (mock — Stripe provides this in production)."""
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == current_user.id, Payment.status == "succeeded")
        .order_by(Payment.created_at.desc())
    )
    payments = result.scalars().all()
    return {
        "invoices": [
            {
                "id": f"inv_{str(p.id)[:8]}",
                "payment_id": str(p.id),
                "amount_cents": p.amount_cents,
                "currency": p.currency,
                "date": p.created_at.isoformat(),
                "receipt_url": p.receipt_url,
            }
            for p in payments
        ]
    }
