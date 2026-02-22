from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime
from uuid import UUID

from app.db.session import get_db, AsyncSessionLocal
from app.api.dependencies import get_admin_user, get_current_user
from app.models.user import User
from app.models.knowledge_base import KnowledgeBaseSource
from app.schemas.knowledge_base import (
    KnowledgeBaseSourceResponse,
    KnowledgeBaseSourceCreate,
    KnowledgeBaseSourceUpdate,
)
from app.services.crawler_service import CrawlerService
import logging

router = APIRouter()

logger = logging.getLogger("cloudwise")

@router.get("/", response_model=list[KnowledgeBaseSourceResponse])
async def list_knowledge_bases(
    category: str = None,
    target_agent: str = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all knowledge base sources."""
    query = select(KnowledgeBaseSource).where(KnowledgeBaseSource.is_active == True)
    if category:
        query = query.where(KnowledgeBaseSource.category == category)
    if target_agent:
        query = query.where(KnowledgeBaseSource.target_agent == target_agent)
        
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/", response_model=KnowledgeBaseSourceResponse)
async def create_knowledge_base(
    kb_in: KnowledgeBaseSourceCreate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new Knowledge Base Source."""
    kb_data = kb_in.dict()
    
    kb = KnowledgeBaseSource(**kb_data)
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    return kb


# Helper for background task
async def run_kb_processing(kb_id: UUID):
    # We need a new session context here
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(KnowledgeBaseSource).where(KnowledgeBaseSource.id == kb_id))
            kb = result.scalar_one_or_none()
            if not kb:
                return
            
            kb.status = "processing"
            await db.commit()
            
            if kb.content_url:
                crawler = CrawlerService()
                summary = await crawler.crawl_and_summarize(kb.content_url)
                kb.processed_content = summary
                kb.status = "indexed"
                kb.updated_at = datetime.utcnow()
                await db.commit()
        except Exception as e:
            logger.exception("Error processing KB %s", kb_id)
            # Try to update status if possible
            try:
                # Need to fetch again or rollback if transaction failed
                await db.rollback()
                result = await db.execute(select(KnowledgeBaseSource).where(KnowledgeBaseSource.id == kb_id))
                kb = result.scalar_one_or_none()
                if kb:
                    kb.status = "failed"
                    await db.commit()
            except Exception as e2:
                logger.exception("Error handling failure for KB %s: %s", kb_id, e2)

@router.post("/{kb_id}/process", response_model=KnowledgeBaseSourceResponse)
async def process_knowledge_base(
    kb_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger background crawling and indexing for a Knowledge Base Source."""
    result = await db.execute(select(KnowledgeBaseSource).where(KnowledgeBaseSource.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")

    if not kb.content_url:
        raise HTTPException(status_code=400, detail="Knowledge Base has no content URL")

    # Update status immediately
    kb.status = "pending"
    await db.commit()
    await db.refresh(kb)
    
    # Add background task
    background_tasks.add_task(run_kb_processing, kb_id)
    
    return kb


@router.put("/{kb_id}", response_model=KnowledgeBaseSourceResponse)
async def update_knowledge_base(
    kb_id: UUID,
    kb_in: KnowledgeBaseSourceUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a Knowledge Base Source."""
    result = await db.execute(select(KnowledgeBaseSource).where(KnowledgeBaseSource.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")

    update_data = kb_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(kb, field, value)

    await db.commit()
    await db.refresh(kb)
    return kb


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(
    kb_id: UUID,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a Knowledge Base Source."""
    result = await db.execute(select(KnowledgeBaseSource).where(KnowledgeBaseSource.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")

    await db.delete(kb)
    await db.commit()
