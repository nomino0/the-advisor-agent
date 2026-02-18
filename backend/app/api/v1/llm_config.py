from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from uuid import UUID

from app.db.session import get_db
from app.api.dependencies import get_admin_user
from app.models.user import User
from app.models.llm_provider import LLMProvider
from app.schemas.llm_provider import (
    LLMProviderResponse,
    LLMProviderCreate,
    LLMProviderUpdate,
)

router = APIRouter()

@router.get("/", response_model=list[LLMProviderResponse])
async def list_providers(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all configured LLM providers."""
    result = await db.execute(select(LLMProvider).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/", response_model=LLMProviderResponse)
async def create_provider(
    provider_in: LLMProviderCreate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new LLM provider configuration."""
    # Check for duplicate name
    existing = await db.execute(select(LLMProvider).where(LLMProvider.name == provider_in.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Provider '{provider_in.name}' already exists."
        )

    provider = LLMProvider(**provider_in.dict())
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


@router.put("/{provider_id}", response_model=LLMProviderResponse)
async def update_provider(
    provider_id: UUID,
    provider_in: LLMProviderUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an LLM provider."""
    result = await db.execute(select(LLMProvider).where(LLMProvider.id == provider_id))
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    update_data = provider_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(provider, field, value)

    await db.commit()
    await db.refresh(provider)
    return provider


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: UUID,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an LLM provider."""
    result = await db.execute(select(LLMProvider).where(LLMProvider.id == provider_id))
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    await db.delete(provider)
    await db.commit()
