from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class RagDocumentBase(BaseModel):
    title: str
    collection: str
    description: Optional[str] = None
    target_agent: Optional[str] = "general"

class RagDocumentCreate(RagDocumentBase):
    pass

class RagDocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_agent: Optional[str] = None
    collection: Optional[str] = None

class RagDocumentResponse(RagDocumentBase):
    id: UUID
    source_url: Optional[str] = None
    file_path: Optional[str] = None
    chunk_count: int
    status: str
    created_at: datetime
    uploaded_by: UUID

    class Config:
        orm_mode = True
