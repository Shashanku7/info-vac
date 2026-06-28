"""Comparator — Phase 6.

Generates a strategic competitive comparison between multiple loyalty programs
from gate-verified extracted_fields rows. Every factual claim includes an
inline citation (source: <url>) derived from the verified data.

Grounding strategy:
  - Only gate_passed=TRUE AND is_null=FALSE rows are fed to the LLM.
  - Source URLs come from extracted_fields → sources.url.
  - The LLM repeats real URLs, it does not invent them.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional, Any

import structlog
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.extractor import _make_client
from backend.models import Comparison, ExtractedField, Program, Source

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Pydantic output schema — Structured Market Matrix
# ---------------------------------------------------------------------------

class MatrixItem(BaseModel):
    """Rankings and rationale for a single loyalty program category."""
    category: str = Field(description="The category name (e.g., 'Tier System', 'Earn Mechanics')")
    rankings: list[str] = Field(
        description="Ranked list of program names from best to worst, e.g. ['Starbucks Rewards', 'Delta SkyMiles']"
    )
    rationale: str = Field(
        description=(
            "Factual strategic rationale explaining the ranking order. "
            "Must end with (source: <url>) citing the exact URL from the GROUNDED DATA block."
        )
    )


class MarketMatrixOutput(BaseModel):
    """Structured competitive market matrix comparison."""
    executive_summary: str = Field(
        description=(
            "2-3 sentence high-level analyst verdict comparing all programs. "
            "Include inline (source: <url>) citations."
        )
    )
    matrix: list[MatrixItem] = Field(
        description="Category-by-category ranking and rationale."
    )
    strategic_recommendations: str = Field(
        description=(
            "Analyst-grade strategic takeaways and recommendations. "
            "Include inline (source: <url>) citations."
        )
    )


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a loyalty program analyst writing a competitive intelligence market matrix comparison.

Rules:
1. Use ONLY the information in the GROUNDED DATA block. Do not use any training knowledge.
2. Every sentence that states a specific fact must end with (source: <url>) using the exact URL from the data.
3. For each category in the matrix, rank the programs from best to worst and write a professional strategic rationale.
4. If a category has no data for any program, skip it entirely — do not pad with guesses.
5. Do not invent, infer, or extrapolate beyond what is in the GROUNDED DATA block.
"""

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
# Context assembly
# ---------------------------------------------------------------------------

async def _build_comparison_context_multi(
    programs_data: list[dict[str, Any]],
    url_by_source_id: dict[str, str],
) -> str:
    """Build the GROUNDED DATA block with multiple programs side by side."""
    
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
    ]
    for prog in programs_data:
        lines.append(f"=== PROGRAM: {prog['name']} ===")
        lines.extend(_format_program_fields(prog['name'], prog['fields']))
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Helper: load fields + source URLs for a program
# ---------------------------------------------------------------------------

async def _load_program_data(
    program_id: uuid.UUID,
    session: AsyncSession,
) -> tuple[str, list[ExtractedField], dict[str, str]]:
    """Load program name, gate-passed fields, and source URL map."""
    program = await session.get(Program, program_id)
    program_name = program.name if program else str(program_id)

    # Load gate-passed, non-null extracted fields
    fields_result = await session.execute(
        select(ExtractedField).where(
            ExtractedField.program_id == program_id,
            ExtractedField.gate_passed == True,
            ExtractedField.is_null == False,
        )
    )
    fields = ExtractedField.get_latest_only(fields_result.scalars().all())

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
    program_ids_or_a_id: list[str] | str,
    session_or_b_id: AsyncSession | str,
    session: Optional[AsyncSession] = None,
) -> Optional[Comparison]:
    """Generate and persist a strategic comparison between 2 or more programs.

    Supports both old (a_id, b_id, session) signature and new (list[str], session) signature.
    """
    if isinstance(program_ids_or_a_id, str):
        program_ids = [program_ids_or_a_id, session_or_b_id]
        db_session = session
    else:
        program_ids = program_ids_or_a_id
        db_session = session_or_b_id

    if not db_session:
        raise ValueError("Database session is required.")

    log.info("comparison_start", program_ids=program_ids)

    try:
        programs_data = []
        url_map = {}
        program_names = []

        for p_id in program_ids:
            pid_uuid = uuid.UUID(p_id)
            name, fields, urls = await _load_program_data(pid_uuid, db_session)
            programs_data.append({
                "id": pid_uuid,
                "name": name,
                "fields": fields,
            })
            url_map.update(urls)
            program_names.append(name)

        # 2. Build grounded context block
        context = await _build_comparison_context_multi(programs_data, url_map)

        log.info(
            "comparison_context_built",
            program_count=len(program_ids),
            total_fields=sum(len(p["fields"]) for p in programs_data),
        )

        # 3. Make LLM call
        client, model_name = _make_client()
        
        prompt = (
            f"Write a strategic competitive market matrix comparison between the following loyalty programs:\n"
            f"  {', '.join(program_names)}\n\n"
            f"{context}\n\n"
            "Generate the comparison now. For each category, rank the programs from best to worst and write "
            "a factual, grounded strategic rationale. Use inline (source: <url>) after every single fact statement."
        )

        kwargs: dict = {
            "response_model": MarketMatrixOutput,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.0,
        }
        if model_name and not model_name.startswith("gemini"):
            kwargs["model"] = model_name

        loop = asyncio.get_running_loop()
        def _call_llm():
            res = client.chat.completions.create(**kwargs)
            return res.model_dump()

        analysis = await loop.run_in_executor(None, _call_llm)

        # 4. Persist to comparisons table
        pid_uuids = [uuid.UUID(p_id) for p_id in program_ids]
        comparison = Comparison(
            id=uuid.uuid4(),
            program_a_id=pid_uuids[0],
            program_b_id=pid_uuids[1] if len(pid_uuids) > 1 else None,
            program_ids=pid_uuids,
            analysis_json=analysis,
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(comparison)
        await db_session.flush()

        log.info(
            "comparison_done",
            comparison_id=str(comparison.id),
            program_ids=[str(p) for p in pid_uuids],
        )
        return comparison

    except Exception as exc:
        log.error(
            "comparison_failed",
            program_ids=program_ids,
            error=str(exc)[:400],
        )
        return None
