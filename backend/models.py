"""SQLAlchemy ORM models — Phase 1: Program + Source."""
import hashlib
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, DateTime, Text, Boolean, ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Program(Base):
    __tablename__ = "programs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    llm_used = Column(String(50), nullable=False, default="gemini")
    schema_version = Column(String(10), nullable=False, default="v1")
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)

    sources = relationship("Source", back_populates="program", cascade="all, delete-orphan")


class Source(Base):
    """A fetched web source for a loyalty program.

    Columns mirror the sources table defined in 0001_initial_schema.py.
    """
    __tablename__ = "sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id = Column(
        UUID(as_uuid=True),
        ForeignKey("programs.id", ondelete="CASCADE"),
        nullable=False,
    )
    url = Column(Text, nullable=False)
    source_type = Column(String(50), nullable=False)  # homepage|faq|tnc|app_review|press|news|forum
    title = Column(Text, nullable=True)
    raw_content = Column(Text, nullable=True)
    content_hash = Column(String(64), nullable=True)
    fetch_method = Column(String(20), nullable=False, default="firecrawl")  # firecrawl|tavily_snippet
    fetched_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    fetch_status = Column(String(20), nullable=False, default="success")  # success|failed|blocked

    program = relationship("Program", back_populates="sources")

    __table_args__ = (UniqueConstraint("program_id", "url", name="uq_source_program_url"),)

    @staticmethod
    def make_hash(content: str) -> str:
        return hashlib.sha256(content.encode("utf-8", errors="replace")).hexdigest()
