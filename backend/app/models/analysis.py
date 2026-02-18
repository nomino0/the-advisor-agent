"""Analysis database model."""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, Float, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from sqlalchemy import Enum as SAEnum

from app.db.session import Base


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class SourceType(str, enum.Enum):
    UPLOAD = "upload"
    GITHUB = "github"
    GITLAB = "gitlab"
    GOOGLE_DRIVE = "google_drive"


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        SAEnum(AnalysisStatus, name="analysis_status"),
        default=AnalysisStatus.PENDING,
        nullable=False,
    )
    source_type: Mapped[str] = mapped_column(
        SAEnum(SourceType, name="source_type"), default=SourceType.UPLOAD
    )
    source_ref: Mapped[str] = mapped_column(String(500), nullable=True)
    project_name: Mapped[str] = mapped_column(String(255), nullable=True)

    # Code metadata
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    total_lines: Mapped[int] = mapped_column(Integer, default=0)
    languages: Mapped[dict] = mapped_column(JSON, nullable=True)

    # Results
    overall_score: Mapped[float] = mapped_column(Float, nullable=True)
    security_score: Mapped[float] = mapped_column(Float, nullable=True)
    maintainability_score: Mapped[float] = mapped_column(Float, nullable=True)
    scalability_score: Mapped[float] = mapped_column(Float, nullable=True)
    observability_score: Mapped[float] = mapped_column(Float, nullable=True)
    testability_score: Mapped[float] = mapped_column(Float, nullable=True)
    modularity_score: Mapped[float] = mapped_column(Float, nullable=True)
    efficiency_score: Mapped[float] = mapped_column(Float, nullable=True)
    report_data: Mapped[dict] = mapped_column(JSON, nullable=True)

    # Payment / access
    is_unlocked: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="analyses")
    agent_executions = relationship("AgentExecution", back_populates="analysis", lazy="selectin")
    reports = relationship("AnalysisReport", back_populates="analysis", lazy="selectin")
    payment = relationship("Payment", back_populates="analysis", uselist=False, lazy="selectin")


class AgentExecution(Base):
    __tablename__ = "agent_executions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id"), nullable=False
    )
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    input_summary: Mapped[str] = mapped_column(Text, nullable=True)
    output_summary: Mapped[str] = mapped_column(Text, nullable=True)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    execution_time_ms: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    analysis = relationship("Analysis", back_populates="agent_executions")
