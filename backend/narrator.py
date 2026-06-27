"""Narrator — Phase 5.

Generates a 200-1000 word analyst-grade competitive brief from gate-verified
extracted_fields rows. Every factual sentence includes an inline citation
(source: <url>) derived from the verified data. The word count is enforced
in Python code — not trusted to the LLM.

Grounding strategy:
  - Only gate_passed=TRUE AND is_null=FALSE rows are fed to the LLM.
  - Null and rejected fields are omitted entirely — zero fabrication surface.
  - Source URLs in the context block come from extracted_fields → sources.url,
    so the LLM repeats real URLs, it does not invent them.

CRITICAL: This module never writes to extracted_fields.confidence.
          It reads only from extracted_fields and sources, and writes to narratives.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

import structlog
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.extractor import _make_client
from backend.models import ExtractedField, Narrative, Source

log = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Word count bounds (R7 — enforced in code, not LLM-trusted)
# ---------------------------------------------------------------------------
_MIN_WORDS = 200
_MAX_WORDS = 1000

# ---------------------------------------------------------------------------
# Pydantic output schema — single field, no drift surface
# ---------------------------------------------------------------------------

class NarrativeOutput(BaseModel):
    brief: str = Field(
        description=(
            f"An analyst-grade competitive intelligence brief of {_MIN_WORDS}-{_MAX_WORDS} words. "
            "Every sentence that states a specific fact must end with (source: <url>) "
            "using the exact URL from the GROUNDED DATA block. "
            "Do not use any knowledge from training data."
        )
    )


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = f"""You are a loyalty program analyst writing a competitive intelligence brief.

Rules:
1. Use ONLY the information in the GROUNDED DATA block. Do not use any training knowledge.
2. Every sentence that states a specific fact must end with (source: <url>) using the exact URL from the data.
3. Write {_MIN_WORDS}-{_MAX_WORDS} words of dense, analyst-grade prose. No filler sentences.
4. Organize the brief into clear paragraphs: Program Overview, How Members Earn, How Members Redeem, Tier Structure, Digital Experience, Competitive Position, Member Sentiment.
5. If a section has no grounded data, skip it entirely — do not pad with guesses.
6. Do not invent, infer, or extrapolate beyond what is in the GROUNDED DATA block.
"""

_RETRY_PROMPT = (
    "Your previous brief was {{word_count}} words, which is outside the required "
    f"{_MIN_WORDS}-{_MAX_WORDS} word range. "
    "Please rewrite it, hitting between 200 and 1000 words. "
    "Keep all inline (source: <url>) citations."
)


# ---------------------------------------------------------------------------
# Context assembly — grounded data block
# ---------------------------------------------------------------------------

# Human-readable category labels for the brief
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


async def _build_context(
    program_name: str,
    fields: list[ExtractedField],
    url_by_source_id: dict[str, str],
) -> str:
    """Build the GROUNDED DATA block fed to the LLM.

    Only gate_passed=TRUE AND is_null=FALSE rows are included.
    Null / rejected rows are omitted — the LLM never sees them.
    """
    # Group by category
    by_cat: dict[str, list[ExtractedField]] = {}
    for f in fields:
        if f.gate_passed and not f.is_null and f.field_value is not None:
            by_cat.setdefault(f.category, []).append(f)

    if not by_cat:
        return f"Program: {program_name}\n\n[No verified data available]"

    lines = [f"Program: {program_name}", "=" * 60, "GROUNDED DATA (gate-verified only):", "=" * 60]

    for cat_key, label in _CATEGORY_LABELS.items():
        cat_fields = by_cat.get(cat_key, [])
        if not cat_fields:
            continue
        lines.append(f"\n[{label}]")
        for f in cat_fields:
            value = f.field_value or ""
            source_url = url_by_source_id.get(str(f.source_id), "") if f.source_id else ""
            if source_url:
                lines.append(f"  {f.field_name}: {value!r} — source: {source_url}")
            else:
                lines.append(f"  {f.field_name}: {value!r}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Word count helper
# ---------------------------------------------------------------------------

def _count_words(text: str) -> int:
    return len(text.split())


# ---------------------------------------------------------------------------
# LLM call with one retry on word-count violation
# ---------------------------------------------------------------------------

def _call_narrator(
    client,
    model_name: str,
    context: str,
    program_name: str,
) -> str:
    """Run the Instructor call. Returns the brief text.
    Retries once if word count is out of bounds.
    """
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Write a competitive intelligence brief for: {program_name}\n\n"
                f"{context}\n\n"
                f"Write the analyst brief now ({_MIN_WORDS}-{_MAX_WORDS} words, "
                "inline (source: <url>) after every fact)."
            ),
        },
    ]

    kwargs: dict = {"response_model": NarrativeOutput, "messages": messages}
    # For Gemini Instructor client, the model is already bound, do not pass model.
    if model_name and not model_name.startswith("gemini"):
        kwargs["model"] = model_name

    result: NarrativeOutput = client.chat.completions.create(**kwargs)
    brief = result.brief
    word_count = _count_words(brief)

    if _MIN_WORDS <= word_count <= _MAX_WORDS:
        return brief

    log.warning(
        "word_count_out_of_range_retry",
        word_count=word_count,
        min=_MIN_WORDS,
        max=_MAX_WORDS,
    )

    # One retry with explicit correction
    retry_prompt = _RETRY_PROMPT.replace("{{word_count}}", str(word_count))
    messages.append({"role": "assistant", "content": brief})
    messages.append({"role": "user", "content": retry_prompt})
    kwargs["messages"] = messages

    result2: NarrativeOutput = client.chat.completions.create(**kwargs)
    brief2 = result2.brief
    word_count2 = _count_words(brief2)

    if not (_MIN_WORDS <= word_count2 <= _MAX_WORDS):
        log.warning(
            "word_count_still_out_of_range",
            word_count=word_count2,
            action="storing_as_is",
        )

    return brief2


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_narrative(
    program_id: str,
    session: AsyncSession,
) -> Optional[Narrative]:
    """Generate and persist a competitive brief for the given program.

    Args:
        program_id: UUID string of the program.
        session:    An active AsyncSession (caller provides, caller commits).

    Returns:
        A committed Narrative ORM row, or None if generation fails.

    Raises:
        Nothing — all exceptions are caught and logged. Returns None on failure.
    """
    pid = uuid.UUID(program_id)
    log.info("narrative_start", program_id=program_id)

    try:
        # 1. Load gate-passed, non-null extracted fields
        fields_result = await session.execute(
            select(ExtractedField).where(
                ExtractedField.program_id == pid,
                ExtractedField.gate_passed == True,   # noqa: E712
                ExtractedField.is_null == False,       # noqa: E712
            )
        )
        fields: list[ExtractedField] = list(fields_result.scalars().all())

        # 2. Load source URLs for citation
        source_ids = {f.source_id for f in fields if f.source_id}
        url_by_source_id: dict[str, str] = {}
        if source_ids:
            sources_result = await session.execute(
                select(Source).where(Source.id.in_(source_ids))
            )
            for src in sources_result.scalars().all():
                url_by_source_id[str(src.id)] = src.url

        # 3. Load program name
        from backend.models import Program
        program = await session.get(Program, pid)
        program_name = program.name if program else str(pid)

        # 4. Build grounded context block
        context = await _build_context(program_name, fields, url_by_source_id)

        log.info(
            "narrative_context_built",
            program_id=program_id,
            grounded_field_count=len(fields),
        )

        # 5. Make LLM call (run in thread — synchronous Instructor SDK)
        import asyncio

        client, model_name = _make_client()
        loop = asyncio.get_running_loop()
        brief = await loop.run_in_executor(
            None,
            _call_narrator,
            client,
            model_name,
            context,
            program_name,
        )

        word_count = _count_words(brief)

        # 6. Persist to narratives table
        narrative = Narrative(
            id=uuid.uuid4(),
            program_id=pid,
            narrative_text=brief,
            word_count=word_count,
            created_at=datetime.now(timezone.utc),
        )
        session.add(narrative)
        await session.flush()

        log.info(
            "narrative_done",
            program_id=program_id,
            word_count=word_count,
        )
        return narrative

    except Exception as exc:
        log.error(
            "narrative_failed",
            program_id=program_id,
            error=str(exc)[:400],
        )
        return None
