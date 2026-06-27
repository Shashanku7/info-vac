"""Comparator — Phase 6.

Generates a strategic competitive comparison between two loyalty programs
from gate-verified extracted_fields rows. Every factual claim includes an
inline citation (source: <url>) derived from the verified data.

Grounding strategy:
  - Only gate_passed=TRUE AND is_null=FALSE rows are fed to the LLM.
  - Source URLs come from extracted_fields → sources.url.
  - The LLM repeats real URLs, it does not invent them.

CRITICAL: This module never writes to extracted_fields.confidence.
          It reads only from extracted_fields, sources, and programs,
          and writes to comparisons.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

import structlog
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.extractor import _make_client
from backend.models import Comparison, ExtractedField, Program, Source

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Pydantic output schema — structured strategic diff
# ---------------------------------------------------------------------------

class AdvantageItem(BaseModel):
    """One strategic advantage one program holds over the other."""
    area: str = Field(description="Category or aspect (e.g., 'Earn Mechanics', 'Digital Experience')")
    description: str = Field(
        description=(
            "A specific, factual description of the advantage. "
            "Must end with (source: <url>) citing the exact URL from the GROUNDED DATA block."
        )
    )


class CategoryDiff(BaseModel):
    """A meaningful difference between the two programs in one category."""
    category: str = Field(description="The category name (e.g., 'Tier System')")
    program_a_value: str = Field(description="What Program A offers in this category")
    program_b_value: str = Field(description="What Program B offers in this category")
    analysis: str = Field(
        description="Why this difference matters strategically, with inline (source: <url>) citations"
    )


class ComparisonOutput(BaseModel):
    """Structured strategic comparison between two loyalty programs."""
    executive_summary: str = Field(
        description=(
            "2-3 sentence high-level verdict comparing both programs. "
            "Include inline (source: <url>) citations."
        )
    )
    advantages_a: list[AdvantageItem] = Field(
        description="Strategic advantages Program A holds over Program B"
    )
    advantages_b: list[AdvantageItem] = Field(
        description="Strategic advantages Program B holds over Program A"
    )
    key_differences: list[CategoryDiff] = Field(
        description="Category-by-category differences where meaningful gaps exist"
    )
    gaps: list[str] = Field(
        description="Missing capabilities or data gaps in either program"
    )
    strategic_recommendation: str = Field(
        description=(
            "Analyst-grade strategic takeaway: which program is stronger overall and why. "
            "Include inline (source: <url>) citations."
        )
    )


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a loyalty program analyst writing a strategic competitive comparison.

Rules:
1. Use ONLY the information in the GROUNDED DATA block. Do not use any training knowledge.
2. Every sentence that states a specific fact must end with (source: <url>) using the exact URL from the data.
3. Focus on STRATEGIC differences — advantages, gaps, and differentiation — not just side-by-side listing.
4. If a category has no data for either program, skip it entirely — do not pad with guesses.
5. Do not invent, infer, or extrapolate beyond what is in the GROUNDED DATA block.
6. Be direct and analyst-grade: identify which program is stronger in each area and why.
"""


# ---------------------------------------------------------------------------
# Category labels (same as narrator)
# ---------------------------------------------------------------------------

_CATEGORY_LABELS: dict[str, str] = {
    "program_basics": "PROGRAM BASICS",
    "partnerships": "PARTNERSHIPS",
    "earn_mechanics": "EARN MECHANICS",
    "burn_mechanics": "BURN MECHANICS",
    "digital_experience": "DIGITAL EXPERIENCE",
    "tier_system": "TIER SYSTEM",
    "member_sentiment": "MEMBER SENTIMENT",
    "competitive_position": "COMPETITIVE POSITION",
}


# ---------------------------------------------------------------------------
# Context assembly — grounded data block for both programs
# ---------------------------------------------------------------------------

async def _build_comparison_context(
    program_a_name: str,
    program_b_name: str,
    fields_a: list[ExtractedField],
    fields_b: list[ExtractedField],
    url_by_source_id: dict[str, str],
) -> str:
    """Build the GROUNDED DATA block with both programs side by side.

    Only gate_passed=TRUE AND is_null=FALSE rows are included.
    """

    def _format_program_fields(
        program_name: str,
        fields: list[ExtractedField],
    ) -> list[str]:
        by_cat: dict[str, list[ExtractedField]] = {}
        for f in fields:
            if f.gate_passed and not f.is_null and f.field_value is not None:
                by_cat.setdefault(f.category, []).append(f)

        if not by_cat:
            return [f"  [{program_name}]: No verified data available"]

        lines = []
        for cat_key, label in _CATEGORY_LABELS.items():
            cat_fields = by_cat.get(cat_key, [])
            if not cat_fields:
                continue
            lines.append(f"\n  [{label}]")
            for f in cat_fields:
                value = f.field_value or ""
                source_url = url_by_source_id.get(str(f.source_id), "") if f.source_id else ""
                if source_url:
                    lines.append(f"    {f.field_name}: {value!r} — source: {source_url}")
                else:
                    lines.append(f"    {f.field_name}: {value!r}")
        return lines

    lines = [
        "=" * 60,
        "GROUNDED DATA (gate-verified only):",
        "=" * 60,
        "",
        f"=== PROGRAM A: {program_a_name} ===",
    ]
    lines.extend(_format_program_fields(program_a_name, fields_a))
    lines.append("")
    lines.append(f"=== PROGRAM B: {program_b_name} ===")
    lines.extend(_format_program_fields(program_b_name, fields_b))

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# LLM call
# ---------------------------------------------------------------------------

def _call_comparator(
    client,
    model_name: str,
    context: str,
    program_a_name: str,
    program_b_name: str,
) -> dict:
    """Run the Instructor call. Returns the comparison as a dict."""
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Write a strategic competitive comparison between:\n"
                f"  Program A: {program_a_name}\n"
                f"  Program B: {program_b_name}\n\n"
                f"{context}\n\n"
                "Produce the strategic comparison now. Focus on advantages, gaps, "
                "and differentiation — not just side-by-side data. "
                "Use inline (source: <url>) after every fact."
            ),
        },
    ]

    kwargs: dict = {"response_model": ComparisonOutput, "messages": messages}
    if model_name and not model_name.startswith("gemini"):
        kwargs["model"] = model_name

    result: ComparisonOutput = client.chat.completions.create(**kwargs)
    return result.model_dump()


# ---------------------------------------------------------------------------
# Helper: load fields + source URLs for a program
# ---------------------------------------------------------------------------

async def _load_program_data(
    program_id: uuid.UUID,
    session: AsyncSession,
) -> tuple[str, list[ExtractedField], dict[str, str]]:
    """Load program name, gate-passed fields, and source URL map.

    Returns:
        (program_name, fields, url_by_source_id)
    """
    # Load program name
    program = await session.get(Program, program_id)
    program_name = program.name if program else str(program_id)

    # Load gate-passed, non-null extracted fields
    fields_result = await session.execute(
        select(ExtractedField).where(
            ExtractedField.program_id == program_id,
            ExtractedField.gate_passed == True,   # noqa: E712
            ExtractedField.is_null == False,       # noqa: E712
        )
    )
    fields: list[ExtractedField] = list(fields_result.scalars().all())

    # Load source URLs for citation
    source_ids = {f.source_id for f in fields if f.source_id}
    url_by_source_id: dict[str, str] = {}
    if source_ids:
        sources_result = await session.execute(
            select(Source).where(Source.id.in_(source_ids))
        )
        for src in sources_result.scalars().all():
            url_by_source_id[str(src.id)] = src.url

    return program_name, fields, url_by_source_id


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def compare_programs(
    program_a_id: str,
    program_b_id: str,
    session: AsyncSession,
) -> Optional[Comparison]:
    """Generate and persist a strategic comparison between two programs.

    Args:
        program_a_id: UUID string of the first program.
        program_b_id: UUID string of the second program.
        session:      An active AsyncSession (caller provides, caller commits).

    Returns:
        A Comparison ORM row (flushed, not committed), or None on failure.

    Raises:
        Nothing — all exceptions are caught and logged. Returns None on failure.
    """
    pid_a = uuid.UUID(program_a_id)
    pid_b = uuid.UUID(program_b_id)
    log.info("comparison_start", program_a=program_a_id, program_b=program_b_id)

    try:
        # 1. Load data for both programs
        name_a, fields_a, urls_a = await _load_program_data(pid_a, session)
        name_b, fields_b, urls_b = await _load_program_data(pid_b, session)

        # Merge URL maps
        url_map = {**urls_a, **urls_b}

        # 2. Build grounded context block
        context = await _build_comparison_context(
            name_a, name_b, fields_a, fields_b, url_map,
        )

        log.info(
            "comparison_context_built",
            program_a=program_a_id,
            program_b=program_b_id,
            fields_a_count=len(fields_a),
            fields_b_count=len(fields_b),
        )

        # 3. Make LLM call (run in thread — synchronous Instructor SDK)
        client, model_name = _make_client()
        loop = asyncio.get_running_loop()
        analysis = await loop.run_in_executor(
            None,
            _call_comparator,
            client,
            model_name,
            context,
            name_a,
            name_b,
        )

        # 4. Persist to comparisons table
        comparison = Comparison(
            id=uuid.uuid4(),
            program_a_id=pid_a,
            program_b_id=pid_b,
            analysis_json=analysis,
            created_at=datetime.now(timezone.utc),
        )
        session.add(comparison)
        await session.flush()

        log.info(
            "comparison_done",
            program_a=program_a_id,
            program_b=program_b_id,
            comparison_id=str(comparison.id),
        )
        return comparison

    except Exception as exc:
        log.error(
            "comparison_failed",
            program_a=program_a_id,
            program_b=program_b_id,
            error=str(exc)[:400],
        )
        return None
