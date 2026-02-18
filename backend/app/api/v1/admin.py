"""Admin endpoints — dashboard, users, API keys, RAG documents, audit logs, revenue."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from typing import Optional, List

from app.db.session import get_db
from app.api.dependencies import get_admin_user
from app.models.user import User
from app.models.analysis import Analysis, AnalysisStatus
from app.models.audit_log import AuditLog
from app.models.api_key import ApiKey
from app.models.rag_document import RagDocument
from app.models.payment import Payment
from app.services.audit_service import record_audit

router = APIRouter()


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ==================== Dashboard / Stats ====================

@router.get("/dashboard")
async def admin_dashboard(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin dashboard metrics."""
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_analyses = (await db.execute(select(func.count(Analysis.id)))).scalar() or 0
    completed_analyses = (
        await db.execute(
            select(func.count(Analysis.id)).where(Analysis.status == AnalysisStatus.COMPLETED)
        )
    ).scalar() or 0
    avg_score = (
        await db.execute(
            select(func.avg(Analysis.overall_score)).where(Analysis.overall_score.isnot(None))
        )
    ).scalar()
    total_revenue = (
        await db.execute(
            select(func.sum(Payment.amount_cents)).where(Payment.status == "succeeded")
        )
    ).scalar() or 0

    return {
        "total_users": total_users,
        "total_analyses": total_analyses,
        "completed_analyses": completed_analyses,
        "average_score": round(avg_score, 1) if avg_score else None,
        "total_revenue_cents": total_revenue,
    }


@router.get("/stats")
async def admin_stats(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get platform statistics (alias for dashboard)."""
    return await admin_dashboard(admin, db)


# ==================== User Management ====================

@router.get("/users")
async def list_users(
    page: int = 1,
    per_page: int = 20,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users (admin only)."""
    offset = (page - 1) * per_page
    total = (await db.execute(select(func.count(User.id)))).scalar() or 0
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(offset).limit(per_page)
    )
    users = result.scalars().all()

    return {
        "users": [
            {
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role.value if hasattr(u.role, "value") else u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat(),
                "last_login": u.last_login.isoformat() if u.last_login else None,
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Suspend / reactivate / change role of a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    body = await request.json()
    if "is_active" in body:
        user.is_active = body["is_active"]
    if "role" in body:
        user.role = body["role"]
    await db.flush()

    await record_audit(
        db, action="admin.user_update", user_id=admin.id,
        resource=f"user:{user_id}",
        details=f"Admin updated user: {body}",
        ip_address=_get_client_ip(request),
    )

    return {"message": "User updated", "user_id": str(user_id)}


# ==================== API Key Management ====================

class AddApiKeyRequest(BaseModel):
    name: str = Field(..., max_length=255)
    provider: str = Field(..., max_length=100)
    key_value: str = Field(..., min_length=1)
    allowed_agents: Optional[list] = None


@router.get("/api-keys")
async def list_api_keys(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List API keys (masked)."""
    result = await db.execute(select(ApiKey).order_by(ApiKey.created_at.desc()))
    keys = result.scalars().all()
    return {
        "keys": [
            {
                "id": str(k.id),
                "name": k.name,
                "provider": k.provider,
                "masked_key": k.encrypted_key[:4] + "..." + k.encrypted_key[-4:] if len(k.encrypted_key) > 8 else "****",
                "status": k.status,
                "allowed_agents": k.allowed_agents,
                "expires_at": k.expires_at.isoformat() if k.expires_at else None,
                "rotated_at": k.rotated_at.isoformat() if k.rotated_at else None,
                "created_at": k.created_at.isoformat(),
            }
            for k in keys
        ]
    }


@router.post("/api-keys", status_code=201)
async def add_api_key(
    body: AddApiKeyRequest,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new API key (encrypted at rest in production)."""
    key = ApiKey(
        name=body.name,
        provider=body.provider,
        encrypted_key=body.key_value,  # Would be AES-256-GCM encrypted in prod
        allowed_agents=body.allowed_agents,
        status="active",
        created_by=admin.id,
    )
    db.add(key)
    await db.flush()
    await db.refresh(key)

    await record_audit(
        db, action="admin.api_key_add", user_id=admin.id,
        resource=f"api_key:{key.id}",
        details=f"Added API key '{body.name}' for {body.provider}",
        ip_address=_get_client_ip(request),
    )

    return {"message": "API key added", "id": str(key.id)}


@router.put("/api-keys/{key_id}")
async def rotate_api_key(
    key_id: uuid.UUID,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Rotate an API key."""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    body = await request.json()
    new_value = body.get("key_value")
    if new_value:
        key.encrypted_key = new_value
    key.rotated_at = datetime.utcnow()
    await db.flush()

    await record_audit(
        db, action="admin.api_key_rotate", user_id=admin.id,
        resource=f"api_key:{key_id}",
        details=f"Rotated API key '{key.name}'",
        ip_address=_get_client_ip(request),
    )

    return {"message": "API key rotated"}


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: uuid.UUID,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke an API key."""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    key.status = "revoked"
    await db.flush()

    await record_audit(
        db, action="admin.api_key_revoke", user_id=admin.id,
        resource=f"api_key:{key_id}",
        details=f"Revoked API key '{key.name}'",
        ip_address=_get_client_ip(request),
    )

    return {"message": "API key revoked"}


# ==================== RAG Document Management ====================

class AddRagDocRequest(BaseModel):
    collection: str = Field(..., pattern="^(cloud_docs|security|best_practices|pricing)$")
    title: str = Field(..., max_length=500)
    source_url: Optional[str] = None


@router.get("/rag/collections")
async def list_rag_collections(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List RAG knowledge base collections with document counts."""
    result = await db.execute(
        select(
            RagDocument.collection,
            func.count(RagDocument.id).label("doc_count"),
            func.sum(RagDocument.chunk_count).label("total_chunks"),
        ).group_by(RagDocument.collection)
    )
    rows = result.all()
    return {
        "collections": [
            {
                "collection": r.collection,
                "documents": r.doc_count,
                "chunks": r.total_chunks or 0,
            }
            for r in rows
        ]
    }


@router.post("/rag/documents", status_code=201)
async def upload_rag_document(
    body: AddRagDocRequest,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a new RAG document (mock — in production: chunking + embedding + indexing)."""
    doc = RagDocument(
        collection=body.collection,
        title=body.title,
        source_url=body.source_url,
        chunk_count=0,
        status="pending",
        uploaded_by=admin.id,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    # Mock: simulate processing
    doc.chunk_count = 42
    doc.status = "indexed"
    await db.flush()

    await record_audit(
        db, action="admin.rag_upload", user_id=admin.id,
        resource=f"rag_document:{doc.id}",
        details=f"Uploaded RAG doc '{body.title}' to {body.collection}",
        ip_address=_get_client_ip(request),
    )

    return {
        "message": "Document uploaded and indexed",
        "id": str(doc.id),
        "chunk_count": doc.chunk_count,
    }


@router.delete("/rag/documents/{doc_id}")
async def remove_rag_document(
    doc_id: uuid.UUID,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a RAG document."""
    result = await db.execute(select(RagDocument).where(RagDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    title = doc.title
    await db.delete(doc)
    await db.flush()

    await record_audit(
        db, action="admin.rag_delete", user_id=admin.id,
        resource=f"rag_document:{doc_id}",
        details=f"Deleted RAG doc '{title}'",
        ip_address=_get_client_ip(request),
    )

    return {"message": "Document removed"}


@router.post("/rag/reindex")
async def reindex_rag(
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger re-indexing of all RAG documents (mock)."""
    await record_audit(
        db, action="admin.rag_reindex", user_id=admin.id,
        resource="rag", details="Triggered full re-indexing",
        ip_address=_get_client_ip(request),
    )
    return {"message": "Re-indexing started", "status": "processing"}


# ==================== Audit Logs ====================

@router.get("/audit-log")
async def list_audit_logs(
    page: int = 1,
    per_page: int = 50,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """View audit log."""
    offset = (page - 1) * per_page
    total = (await db.execute(select(func.count(AuditLog.id)))).scalar() or 0
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.timestamp.desc()).offset(offset).limit(per_page)
    )
    logs = result.scalars().all()

    return {
        "logs": [
            {
                "id": str(log.id),
                "user_id": str(log.user_id) if log.user_id else None,
                "action": log.action,
                "resource": log.resource,
                "details": log.details,
                "ip_address": log.ip_address,
                "timestamp": log.timestamp.isoformat(),
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


# Keep old path for backward compatibility
@router.get("/audit-logs")
async def list_audit_logs_compat(
    page: int = 1,
    per_page: int = 50,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List audit logs (backward compat)."""
    return await list_audit_logs(page, per_page, admin, db)


# ==================== Agent Performance ====================

@router.get("/performance")
async def agent_performance(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Agent performance metrics."""
    from app.models.analysis import AgentExecution

    result = await db.execute(
        select(
            AgentExecution.agent_name,
            func.count(AgentExecution.id).label("total_runs"),
            func.avg(AgentExecution.execution_time_ms).label("avg_time_ms"),
            func.avg(AgentExecution.tokens_used).label("avg_tokens"),
        ).group_by(AgentExecution.agent_name)
    )
    rows = result.all()
    return {
        "agents": [
            {
                "agent_name": r.agent_name,
                "total_runs": r.total_runs,
                "avg_time_ms": round(r.avg_time_ms, 1) if r.avg_time_ms else 0,
                "avg_tokens": round(r.avg_tokens, 1) if r.avg_tokens else 0,
            }
            for r in rows
        ]
    }


# ==================== Revenue ====================

@router.get("/revenue/dashboard")
async def revenue_dashboard(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Revenue dashboard metrics."""
    total_revenue = (
        await db.execute(
            select(func.sum(Payment.amount_cents)).where(Payment.status == "succeeded")
        )
    ).scalar() or 0
    total_payments = (
        await db.execute(
            select(func.count(Payment.id)).where(Payment.status == "succeeded")
        )
    ).scalar() or 0

    return {
        "total_revenue_cents": total_revenue,
        "total_revenue_usd": round(total_revenue / 100, 2),
        "total_successful_payments": total_payments,
    }

@router.get("/revenue/transactions")
async def revenue_transactions(
    page: int = 1,
    per_page: int = 50,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """All payment transactions."""
    offset = (page - 1) * per_page
    total = (await db.execute(select(func.count(Payment.id)))).scalar() or 0
    result = await db.execute(
        select(Payment).order_by(Payment.created_at.desc()).offset(offset).limit(per_page)
    )
    payments = result.scalars().all()

    return {
        "transactions": [
            {
                "id": str(p.id),
                "user_id": str(p.user_id),
                "analysis_id": str(p.analysis_id) if p.analysis_id else None,
                "amount_cents": p.amount_cents,
                "currency": p.currency,
                "status": p.status,
                "created_at": p.created_at.isoformat(),
            }
            for p in payments
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/rag/documents")
async def list_rag_documents(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all knowledge base documents."""
    result = await db.execute(select(RagDocument).order_by(RagDocument.created_at.desc()))
    return result.scalars().all()


@router.post("/rag/upload")
async def upload_rag_document(
    file: UploadFile = File(...),
    collection: str = Form("cloud_docs"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Upload a document to the knowledge base."""
    # Check duplicate
    existing = await db.execute(select(RagDocument).where(RagDocument.title == file.filename))
    if existing.scalar_one_or_none():
         raise HTTPException(status_code=409, detail="Document already exists")

    doc = RagDocument(
        collection=collection,
        title=file.filename,
        uploaded_by=admin.id,
        chunk_count=0,
        status="pending"
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.post("/rag/{doc_id}/index")
async def index_rag_document(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Trigger indexing for a document."""
    result = await db.execute(select(RagDocument).where(RagDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Simulate indexing
    doc.status = "indexed"
    doc.chunk_count = 15  # Mock chunk count
    doc.updated_at = datetime.utcnow()
    
    # In reality: read file -> chunk -> embed -> vector_db.upsert
    
    await db.commit()
    return doc


@router.delete("/rag/{doc_id}")
async def delete_rag_document(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Delete a document."""
    result = await db.execute(select(RagDocument).where(RagDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.delete(doc)
    await db.commit()
    return {"message": "Document deleted"}
async def revenue_transactions(
    page: int = 1,
    per_page: int = 50,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """All payment transactions."""
    offset = (page - 1) * per_page
    total = (await db.execute(select(func.count(Payment.id)))).scalar() or 0
    result = await db.execute(
        select(Payment).order_by(Payment.created_at.desc()).offset(offset).limit(per_page)
    )
    payments = result.scalars().all()

    return {
        "transactions": [
            {
                "id": str(p.id),
                "user_id": str(p.user_id),
                "analysis_id": str(p.analysis_id) if p.analysis_id else None,
                "amount_cents": p.amount_cents,
                "currency": p.currency,
                "status": p.status,
                "created_at": p.created_at.isoformat(),
            }
            for p in payments
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }
