"""User OAuth connections model — GitHub, GitLab, Google Drive."""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class UserConnection(Base):
    __tablename__ = "user_connections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    provider: Mapped[str] = mapped_column(
        String(50), nullable=False  # github, gitlab, google_drive
    )
    access_token_enc: Mapped[str] = mapped_column(Text, nullable=True)
    refresh_token_enc: Mapped[str] = mapped_column(Text, nullable=True)
    scope: Mapped[str] = mapped_column(String(500), nullable=True)
    provider_username: Mapped[str] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="connections")
