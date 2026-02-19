from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.session import Base

class AnalysisLog(Base):
    __tablename__ = "analysis_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id"), nullable=False)
    agent_name = Column(String, nullable=False) # "Planner", "Security", "Critic"
    action = Column(String, nullable=False) # "Reading File", "Analyzing", "Validating"
    details = Column(String, nullable=True) # "Start reading src/app.py..."
    file_path = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    analysis = relationship("Analysis", back_populates="logs")