from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class KnowledgeBaseSourceBase(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    content_url: Optional[str] = None
    content_text: Optional[str] = None
    processed_content: Optional[str] = None
    target_agent: Optional[str] = None
    status: Optional[str] = "pending"
    is_active: bool = True

class KnowledgeBaseSourceCreate(KnowledgeBaseSourceBase):
    pass

class KnowledgeBaseSourceUpdate(KnowledgeBaseSourceBase):
    pass

class KnowledgeBaseSourceResponse(KnowledgeBaseSourceBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True