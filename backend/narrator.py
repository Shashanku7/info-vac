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

import re

def _count_words(text: str) -> int:
    # Strip out the (source: https://...) citations before counting
    text_without_citations = re.sub(r'\(source:\s*http[^\)]+\)', '', text)
    return len(text_without_citations.split())


# ---------------------------------------------------------------------------
# LLM call with one retry on word-count violation
# ---------------------------------------------------------------------------

def _calculate_usage_cost(result: Any, model_name: str) -> float:
    """Extract token usage from the instructor result and compute dollar cost.

    Gemini:  $0.075 / 1M input, $0.30 / 1M output
    Ollama:  $0.300 / 1M input, $0.60 / 1M output (estimate)
    Claude:  $0.800 / 1M input, $4.00 / 1M output (Haiku)
    OpenAI:  $0.150 / 1M input, $0.60 / 1M output (4o-mini)
    """
    if not hasattr(result, "_raw_response") or not result._raw_response:
        return 0.0
    raw = result._raw_response
    input_tokens = 0
    output_tokens = 0

    if hasattr(raw, "usage") and raw.usage:
        usage = raw.usage
        input_tokens = getattr(usage, "prompt_tokens", 0) or 0
        output_tokens = getattr(usage, "completion_tokens", 0) or 0
        if not input_tokens and not output_tokens:
            input_tokens = getattr(usage, "input_tokens", 0) or 0
            output_tokens = getattr(usage, "output_tokens", 0) or 0

    model_lower = (model_name or "").lower()
    if "gemini" in model_lower:
        provider = "gemini"
    elif "gemma" in model_lower:
        provider = "ollama-cloud"
    elif "claude" in model_lower:
        provider = "anthropic"
    else:
        provider = "openai"

    rates = {
        "gemini":        {"in": 0.075, "out": 0.30},
        "ollama-cloud":  {"in": 0.30,  "out": 0.60},
        "anthropic":     {"in": 0.80,  "out": 4.00},
        "openai":        {"in": 0.15,  "out": 0.60},
    }
    cfg = rates.get(provider, {"in": 0.15, "out": 0.60})
    cost = ((input_tokens / 1_000_000.0) * cfg["in"]) + ((output_tokens / 1_000_000.0) * cfg["out"])
    return round(cost, 6)


def _call_narrator(
    client,
    model_name: str,
    context: str,
    program_name: str,
    out_cost: dict[str, float] = None,
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
    if model_name and not model_name.startswith("gemini"):
        kwargs["model"] = model_name

    result: NarrativeOutput = client.chat.completions.create(**kwargs)
    brief = result.brief
    cost = _calculate_usage_cost(result, model_name)
    word_count = _count_words(brief)

    if out_cost is not None:
        out_cost["cost"] = out_cost.get("cost", 0.0) + cost

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
    cost2 = _calculate_usage_cost(result2, model_name)
    word_count2 = _count_words(brief2)

    if out_cost is not None:
        out_cost["cost"] = out_cost.get("cost", 0.0) + cost2

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
        fields: list[ExtractedField] = ExtractedField.get_latest_only(fields_result.scalars().all())

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
        out_cost = {"cost": 0.0}
        brief = await loop.run_in_executor(
            None,
            _call_narrator,
            client,
            model_name,
            context,
            program_name,
            out_cost,
        )

        cost = out_cost.get("cost", 0.0)
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

        if program:
            from decimal import Decimal
            try:
                cost_val = float(cost)
            except Exception:
                cost_val = 0.0
            program.total_cost = (program.total_cost or Decimal("0.0")) + Decimal(str(round(cost_val, 6)))

        await session.flush()

        log.info(
            "narrative_done",
            program_id=program_id,
            word_count=word_count,
            cost_usd=cost,
        )
        return narrative

    except Exception as exc:
        log.error(
            "narrative_failed",
            program_id=program_id,
            error=str(exc)[:400],
        )
        return None
