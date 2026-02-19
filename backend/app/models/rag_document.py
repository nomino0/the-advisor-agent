"""RAG document model — metadata for knowledge base documents."""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class RagDocument(Base):
    __tablename__ = "rag_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    collection: Mapped[str] = mapped_column(
        String(100), nullable=False  # cloud_docs, security, best_practices, pricing
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    source_url: Mapped[str] = mapped_column(String(1000), nullable=True)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=True)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(
        String(50), default="pending"  # pending, indexed, failed
    )
    description: Mapped[str] = mapped_column(Text, nullable=True, default="")
    target_agent: Mapped[str] = mapped_column(String(50), nullable=True, default="general")
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    uploader = relationship("User", back_populates="rag_documents")
