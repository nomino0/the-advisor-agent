"""Audit log service — records all important user actions."""
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog
from typing import Optional
import uuid


async def record_audit(
    db: AsyncSession,
    action: str,
    user_id: Optional[uuid.UUID] = None,
    resource: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Write an audit log entry to the database."""
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        details=details,
        ip_address=ip_address,
    )
    db.add(log)
    # Don't commit here — let the caller's transaction handle it
    await db.flush()
