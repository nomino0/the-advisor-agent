from pydantic import BaseModel, HttpUrl, Field
from typing import List, Optional
from uuid import UUID

class LLMProviderBase(BaseModel):
    name: str = Field(..., max_length=100)
    provider_type: str = Field("openai", max_length=50)
    base_url: str = Field(..., max_length=500)
    api_key: str = Field(..., max_length=200)
    models: List[str] = Field(default_factory=list)
    priority: int = 10
    is_active: bool = True

class LLMProviderCreate(LLMProviderBase):
    pass

class LLMProviderUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    provider_type: Optional[str] = Field(None, max_length=50)
    base_url: Optional[str] = Field(None, max_length=500)
    api_key: Optional[str] = None
    models: Optional[List[str]] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None

class LLMProviderResponse(LLMProviderBase):
    id: UUID

    class Config:
        from_attributes = True

