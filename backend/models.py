"""SQLAlchemy ORM models — Phase 1-5: Program, Source, ExtractedField, PipelineEvent, Narrative."""
import hashlib
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, DateTime, Text, Boolean, ForeignKey, UniqueConstraint, Numeric, Integer
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


class ExtractedField(Base):
    """One extracted field value — rows in extracted_fields table.

    confidence is populated ONLY by Phase 3 verifier.compute_confidence().
    The extractor never writes to this column.
    """
    __tablename__ = "extracted_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id = Column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False
    )
    category = Column(String(50), nullable=False)
    field_name = Column(String(100), nullable=False)
    field_value = Column(Text, nullable=True)   # stored as text (JSON-serialisable values)
    is_null = Column(Boolean, nullable=False, default=False)

    # Citation-verification gate
    claimed_snippet = Column(Text, nullable=True)
    gate_passed = Column(Boolean, nullable=True)
    match_score = Column(Numeric(4, 3), nullable=True)

    # Confidence sub-scores (Phase 3 only)
    corroboration_score = Column(Numeric(3, 2), nullable=True)
    authority_score = Column(Numeric(3, 2), nullable=True)
    recency_score = Column(Numeric(3, 2), nullable=True)
    confidence = Column(Numeric(3, 2), nullable=True)  # ONLY written by verifier.py

    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=True)
    access_date = Column(DateTime(timezone=True), nullable=True)
    contradiction_flag = Column(Boolean, nullable=False, default=False)
    contradiction_note = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (UniqueConstraint("program_id", "field_name", name="uq_field_program_name"),)


class PipelineEvent(Base):
    """Progress event row — INSERT triggers pg_notify for SSE clients."""
    __tablename__ = "pipeline_events"

    id = Column(String, primary_key=True)   # BIGSERIAL — read as string for safety
    program_id = Column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False
    )
    stage = Column(String(50), nullable=False)
    progress = Column(String(10), nullable=True)   # "0.25" etc.
    detail = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class Narrative(Base):
    """A generated analyst brief — rows in the narratives table.

    Written by Phase 5 (narrator.py). Word count is enforced in Python code,
    not trusted to the LLM.
    """
    __tablename__ = "narratives"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id = Column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False
    )
    narrative_text = Column(Text, nullable=False)
    word_count = Column(Integer, nullable=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
