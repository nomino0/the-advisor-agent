from sqlalchemy import Column, String, Boolean, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.db.session import Base

class LLMProvider(Base):
    __tablename__ = "llm_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, index=True, nullable=False)  # "Groq", "OpenRouter", "Gemini"
    provider_type = Column(String, default="openai") # "openai", "gemini", "anthropic"
    base_url = Column(String, nullable=False)
    api_key = Column(String, nullable=False)  # In prod, this should be encrypted
    models = Column(JSON, default=[])  # List of model names supported
    priority = Column(Integer, default=10) # Lower number = higher priority
    is_active = Column(Boolean, default=True)
    agent_capability = Column(JSON, default=["general"]) # List of capabilities: ["general", "security", "planner", "critic"]

