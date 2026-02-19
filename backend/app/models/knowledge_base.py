from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime
from app.db.session import Base

class KnowledgeBaseSource(Base):
    __tablename__ = "knowledge_base_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True) # e.g., "ISO 27001", "AWS Pricing", "Python Best Practices"
    category = Column(String, nullable=False) # "technology", "cloud_provider", "norm", "agent_instruction"
    description = Column(Text, nullable=True)
    logo_url = Column(String, nullable=True)
    content_url = Column(String, nullable=True) # Link to external doc or internal file path
    content_text = Column(Text, nullable=True) # Inline text content
    processed_content = Column(Text, nullable=True) # Summarized content from crawler
    
    # Target specific agent?
    target_agent = Column(String, nullable=True) # e.g., "security_analyst", "planner", or NULL for all
    
    status = Column(String, default="pending") # pending, processing, indexed, failed
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
