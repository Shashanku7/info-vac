"""Extractor — Phase 2 & 8 Upgrades.

Extracts the 44-field loyalty program schema from fetched sources using
Instructor + LLM. Structured as 9 category-level Pydantic models (8 categories + MetaInsights)
fired in parallel using ThreadPoolExecutor.

LLM backend fallbacks:
  1. GEMINI_API_KEY  → gemini-1.5-flash
  2. OLLAMA_API_KEY  → gemma4:31b-cloud
  3. ANTHROPIC_API_KEY or CLAUDE_API_KEY → claude-3-5-haiku-20241022
  4. OPENAI_API_KEY  → gpt-4o-mini
Each provider is tried in sequence, retrying transient API errors with tenacity.
"""

from __future__ import annotations

import os
import re
import warnings
import asyncio
import concurrent.futures
from typing import Optional, Any

# Suppress FutureWarning from google-generativeai — instructor still uses it
# internally (instructor >= 1.15). Remove when instructor migrates to google-genai.
warnings.filterwarnings("ignore", category=FutureWarning, module="google")

import instructor
import structlog
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.extraction_schemas import (
    EvidenceState,
    ExtractedValue,
    EvidenceStateValue,
    ProgramBasics,
    Partnerships,
    EarnMechanics,
    DigitalExperience,
    BurnMechanics,
    MemberSentiment,
    TierSystem,
    CompetitivePosition,
    MetaInsights,
    ExtractedSchema,
)

log = structlog.get_logger(__name__)

from backend.llm_client import _get_available_backends, _make_client

# ---------------------------------------------------------------------------
# Content Sanitizer — injection defense
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a structured data extractor for loyalty program research.

Your task: extract specific fields from the SOURCE DATA blocks provided in this conversation.

Rules:
1. Only use information explicitly stated in the SOURCE DATA blocks. Do not use training knowledge.
2. For each field, provide the exact verbatim quote from the source that supports your answer.
3. STRICT UNCERTAINTY TUNING: If the source data does not explicitly state the answer, or if you are uncertain, you MUST set value to null and evidence_quote to null.
4. We aggressively penalize hallucinations (false positives). It is much better to output null (honest missing data) than to invent, infer, guess, or extrapolate.
5. If a value is mentioned but lacks clear direct support in the text, you must output null.
6. model_certainty_hint is your honest assessment of how confident you are given ONLY the sources provided.

The user's message will contain labelled SOURCE DATA blocks followed by the extraction request.
"""

# ---------------------------------------------------------------------------
# Source budget allocation — replaces hard 4K truncation
# ---------------------------------------------------------------------------

# Total character budget spread across all sources per LLM call (~50K tokens)
_TOTAL_SOURCE_BUDGET = 200_000

# Authority-ordered source types: higher index = lower priority = smaller share
_SOURCE_PRIORITY_ORDER = ["tnc", "press", "faq", "homepage", "benefits",
                           "news", "mechanics", "partners", "app_review",
                           "competitors", "forum"]

# Weight multipliers per type (high-authority gets more of the budget)
_SOURCE_WEIGHTS: dict[str, float] = {
    "tnc": 1.8, "press": 1.5, "faq": 1.3, "homepage": 1.2,
    "benefits": 1.2, "news": 1.0, "mechanics": 1.0, "partners": 1.0,
    "app_review": 0.8, "competitors": 0.8, "forum": 0.7,
}
_DEFAULT_WEIGHT = 1.0


def _extract_html_tables(html: str) -> Optional[str]:
    """Pull <table> elements out of raw HTML and convert to pipe-delimited text.

    Used for TierSystem extraction only — tier qualification tables survive
    as HTML but lose their column structure in markdown conversion.
    Returns None if no tables found.
    """
    if not html:
        return None
    tables = re.findall(r'<table[^>]*>.*?</table>', html, re.DOTALL | re.IGNORECASE)
    if not tables:
        return None

    lines = ["[HTML TABLES — for tier/benefit structure extraction]"]
    for t_idx, table in enumerate(tables[:8], 1):  # cap at 8 tables
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table, re.DOTALL | re.IGNORECASE)
        if not rows:
            continue
        lines.append(f"\n[TABLE {t_idx}]")
        for row in rows:
            cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row, re.DOTALL | re.IGNORECASE)
            # Strip all HTML tags from cell content
            cell_texts = [re.sub(r'<[^>]+>', ' ', c).strip() for c in cells]
            cell_texts = [c for c in cell_texts if c]  # drop empties
            if cell_texts:
                lines.append(" | ".join(cell_texts))

    return "\n".join(lines) if len(lines) > 1 else None


def _build_source_message(
    program_name: str,
    sources: list,
    use_html_tables: bool = False,
) -> str:
    """Build the user message with sources as data blocks, NOT instructions.

    DESIGN DECISION: LINEAR ORDERING VS BOOKENDING
    At our current scale of 15K-20K tokens (max 50K), Gemini's attention curve is
    essentially flat, meaning "Lost in the Middle" context rot is negligible. 
    Thus, we retain a linear sorting structure:
      1. Semantic Baselines: Placing highest-authority sources (like official T&C) 
         first establishes the foundational "truth" context before the model reads
         secondary or potentially contradictory sources.
      2. Debugging Readability: Linear ordering ensures that prompt logs in 
         LangSmith are cleanly structured and highly human-readable for rapid debugging.
    
    CRITICAL THRESHOLD: If average combined source size grows to exceed 80K tokens, 
    revisit ordering (e.g. migrate to U-Shape/Bookend context packing or two-stage RAG).
    """
    # Sort sources by authority (highest priority first)
    def _priority(s) -> int:
        st = getattr(s, 'source_type', '') or ''
        try:
            return _SOURCE_PRIORITY_ORDER.index(st)
        except ValueError:
            return len(_SOURCE_PRIORITY_ORDER)

    sorted_sources = sorted(sources, key=_priority)

    # Compute per-source character limits using weight-proportional budget
    weights = [_SOURCE_WEIGHTS.get(getattr(s, 'source_type', ''), _DEFAULT_WEIGHT)
               for s in sorted_sources]
    total_weight = sum(weights) or 1.0
    limits = [int(_TOTAL_SOURCE_BUDGET * w / total_weight) for w in weights]

    parts = [f"Extract loyalty program information for: {program_name}\n"]
    parts.append("=" * 60)
    parts.append("SOURCE DATA (use only these sources, do not use training knowledge):")
    parts.append("=" * 60)

    for i, (source, char_limit) in enumerate(zip(sorted_sources, limits), 1):
        content = (source.raw_content or "")[:char_limit]
        parts.append(f"\n--- SOURCE {i}: [{source.source_type.upper()}] {source.url} ---")
        parts.append(content)

        # Append HTML tables if requested and available (TierSystem only)
        if use_html_tables:
            raw_html = getattr(source, 'raw_html', None)
            if raw_html:
                table_text = _extract_html_tables(raw_html)
                if table_text:
                    parts.append("\n[STRUCTURED TABLES FROM HTML — use for tier/benefit extraction]")
                    parts.append(table_text[:8_000])  # cap table block per source

        parts.append(f"--- END SOURCE {i} ---")

    return "\n".join(parts)


def _calculate_usage_cost(result: Any, provider: str) -> float:
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

    rates = {
        "gemini":        {"in": 0.075, "out": 0.30},
        "ollama-cloud":  {"in": 0.30,  "out": 0.60},
        "anthropic":     {"in": 0.80,  "out": 4.00},
        "openai":        {"in": 0.15,  "out": 0.60},
        "groq":          {"in": 0.05,  "out": 0.10},
    }
    cfg = rates.get(provider, {"in": 0.15, "out": 0.60})
    cost = ((input_tokens / 1_000_000.0) * cfg["in"]) + ((output_tokens / 1_000_000.0) * cfg["out"])
    return round(cost, 6)


def _extract_category(
    backends: list[dict[str, Any]],
    response_model: type,
    program_name: str,
    sources: list,
    category_name: str,
    program_id: Optional[str] = None,
    main_loop: Optional[Any] = None,
    delay_seconds: float = 0.0,
) -> tuple[BaseModel | None, float]:
    """Run extraction for a single category, falling back to other backends on failure."""
    if delay_seconds > 0:
        import time
        time.sleep(delay_seconds)

    use_html = (category_name == "Tier System")
    source_msg = _build_source_message(program_name, sources, use_html_tables=use_html)
    category_prompt = f"\nFor the category '{category_name}', extract only the fields defined in the schema."

    def emit_status(msg: str):
        if program_id and main_loop:
            from orchestrator.events import emit_event
            import asyncio
            asyncio.run_coroutine_threadsafe(
                emit_event(
                    program_id,
                    "extracting_fields",
                    0.30,
                    msg
                ),
                main_loop
            )

    for backend in backends:
        provider = backend["provider"]
        model_name = backend["model"]
        try:
            client = backend["client"]()
        except Exception as exc:
            log.warning("failed_to_initialize_client", provider=provider, model=model_name, error=str(exc))
            emit_status(f"Failed to initialize client for {provider} on '{category_name}'. Trying next backend...")
            continue

        log.info("trying_extraction", provider=provider, model=model_name, category=category_name)
        emit_status(f"Extracting category '{category_name}' using {provider} ({model_name})...")

        attempt_count = 0

        @retry(
            stop=stop_after_attempt(2),
            wait=wait_exponential(multiplier=1, min=2, max=10),
            reraise=True,
        )
        def _attempt():
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count > 1:
                emit_status(f"Rate limit / API error on {provider} for '{category_name}'. Retrying (Attempt #{attempt_count})...")
            return client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": source_msg + category_prompt},
                ],
                response_model=response_model,
            )

        try:
            result = _attempt()
            cost = _calculate_usage_cost(result, provider)
            log.info("category_extracted", category=category_name, program=program_name, provider=provider, model=model_name, cost=cost)
            emit_status(f"Successfully extracted category '{category_name}' using {provider}.")
            return result, cost
        except Exception as exc:
            # Report failure/cooldown to key broker if it was a broker-managed client
            try:
                err_msg = str(exc).lower()
                is_quota = "quota" in err_msg or "429" in err_msg or "limit" in err_msg or "resource_exhausted" in err_msg
                from backend.llm_client import gemini_broker, groq_broker
                
                # Extract the api_key value dynamically from the client if present
                raw_key = getattr(getattr(client, "client", None), "api_key", None)
                if raw_key:
                    if provider == "gemini-broker":
                        gemini_broker.report_failure(raw_key, is_quota_exhausted=is_quota)
                    elif provider == "groq-broker":
                        groq_broker.report_failure(raw_key, is_quota_exhausted=is_quota)
            except Exception as broker_exc:
                log.warning("failed_to_report_key_failure_to_broker", error=str(broker_exc))

            log.error(
                "category_extraction_failed_for_backend",
                category=category_name,
                program=program_name,
                provider=provider,
                model=model_name,
                error=str(exc)[:300],
            )
            emit_status(f"{provider} failed for category '{category_name}'. Falling back to next backend...")
            continue

    log.error("all_backends_failed", category=category_name, program=program_name)
    emit_status(f"All backends failed to extract category '{category_name}'.")
    return None, 0.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_CATEGORY_MAP = [
    ("Program Basics", ProgramBasics, "program_basics"),
    ("Partnerships", Partnerships, "partnerships"),
    ("Earn Mechanics", EarnMechanics, "earn_mechanics"),
    ("Digital Experience", DigitalExperience, "digital_experience"),
    ("Burn Mechanics", BurnMechanics, "burn_mechanics"),
    ("Member Sentiment", MemberSentiment, "member_sentiment"),
    ("Tier System", TierSystem, "tier_system"),
    ("Competitive Position", CompetitivePosition, "competitive_position"),
    ("Meta Insights", MetaInsights, "meta_insights"),
]


def extract_fields(
    program_name: str,
    sources: list,
    program_id: str = None,
    main_loop: Any = None,
) -> ExtractedSchema:
    """Extract all 44 fields across 9 categories from the provided sources in parallel.

    Args:
        program_name: Human-readable program name (e.g., "Delta SkyMiles")
        sources:      List of Source ORM objects with raw_content populated
        program_id:   Optional program UUID string for progress events
        main_loop:    Optional asyncio loop to post progress updates

    Returns:
        ExtractedSchema with all 9 category sub-models populated.
    """
    backends = _get_available_backends()
    log.info("extraction_start", program=program_name, source_count=len(sources), backends=[b["provider"] for b in backends])

    category_results: dict[str, BaseModel] = {}
    total_cost_usd = 0.0

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        future_to_cat = {
            executor.submit(
                _extract_category,
                backends,
                cat_model,
                program_name,
                sources,
                cat_name,
                program_id,
                main_loop,
                0.6 * idx  # stagger API start times to stay below rate limit RPS caps
            ): (cat_name, cat_model, cat_key)
            for idx, (cat_name, cat_model, cat_key) in enumerate(_CATEGORY_MAP)
        }

        completed_count = 0
        completed_fields_count = 0
        total_fields_count = 45
        for future in concurrent.futures.as_completed(future_to_cat):
            cat_name, cat_model, cat_key = future_to_cat[future]
            completed_count += 1
            has_error = False
            try:
                res_tuple = future.result()
                if isinstance(res_tuple, tuple):
                    result, cost = res_tuple
                else:
                    result, cost = res_tuple, 0.0
            except Exception as exc:
                log.error("future_raised_exception", category=cat_name, error=str(exc))
                result, cost = None, 0.0
                has_error = True

            total_cost_usd += cost

            if result is None:
                # Fallback: all-null instance so the schema is always complete
                result = cat_model(
                    **{
                        field_name: ExtractedValue(value=None, evidence_quote=None)
                        if getattr(cat_model.model_fields[field_name].annotation, '__name__', '') != 'EvidenceStateValue'
                        else EvidenceStateValue(value=None, evidence_quote=None)
                        for field_name in cat_model.model_fields
                    }
                )
            category_results[cat_key] = result

            fields_in_category = list(result.model_fields.keys())
            category_status = "failed" if has_error else "completed"

            for field_name in fields_in_category:
                completed_fields_count += 1
                if program_id and main_loop:
                    from orchestrator.events import emit_event
                    import json
                    import asyncio
                    
                    item = {
                        "field_name": field_name,
                        "category": cat_name,
                        "status": category_status
                    }
                    progress_val = 0.30 + 0.23 * (completed_fields_count / total_fields_count)
                    asyncio.run_coroutine_threadsafe(
                        emit_event(
                            program_id,
                            "extracting_fields",
                            progress_val,
                            json.dumps({
                                "item": item,
                                "count": completed_fields_count,
                                "total": total_fields_count
                            })
                        ),
                        main_loop
                    )

    schema = ExtractedSchema(
        program_basics=category_results["program_basics"],
        partnerships=category_results["partnerships"],
        earn_mechanics=category_results["earn_mechanics"],
        digital_experience=category_results["digital_experience"],
        burn_mechanics=category_results["burn_mechanics"],
        member_sentiment=category_results["member_sentiment"],
        tier_system=category_results["tier_system"],
        competitive_position=category_results["competitive_position"],
        meta_insights=category_results["meta_insights"],
        extraction_cost=round(total_cost_usd, 6),
    )

    # Count non-null fields for logging
    total = non_null = 0
    for cat_name, cat_model, cat_key in _CATEGORY_MAP:
        cat_obj = getattr(schema, cat_key)
        for fname in cat_model.model_fields:
            total += 1
            ev = getattr(cat_obj, fname)
            val = getattr(ev, "value", None)
            if val is not None and val != EvidenceState.NOT_MENTIONED:
                non_null += 1

    log.info(
        "extraction_done",
        program=program_name,
        total_fields=total,
        non_null_fields=non_null,
        null_fields=total - non_null,
        extraction_cost_usd=round(total_cost_usd, 6),
    )
    return schema


# ---------------------------------------------------------------------------
# Retry helper — called by verify_node for gate-failed fields
# ---------------------------------------------------------------------------

# Maps PipelineState snake_case category keys → (display name, model class)
_SNAKE_CAT_MAP: dict[str, tuple[str, type]] = {
    "program_basics":    ("Program Basics",      ProgramBasics),
    "partnerships":      ("Partnerships",         Partnerships),
    "earn_mechanics":    ("Earn Mechanics",        EarnMechanics),
    "digital_experience":("Digital Experience",   DigitalExperience),
    "burn_mechanics":    ("Burn Mechanics",        BurnMechanics),
    "member_sentiment":  ("Member Sentiment",      MemberSentiment),
    "tier_system":       ("Tier System",           TierSystem),
    "competitive_position":("Competitive Position",CompetitivePosition),
    "meta_insights":     ("Meta Insights",        MetaInsights),
}


def retry_failed_fields(
    program_name: str,
    sources: list,
    failed_fields: dict[str, list[str]],
    program_id: str = None,
    main_loop: Any = None,
) -> tuple[dict[str, dict[str, dict]], float]:
    """One-shot LLM retry for fields that failed gate verification.

    Called by verify_node after multi-source auto re-attribution has already
    been attempted. Makes ONE parallel pass across affected categories.
    """
    backends = _get_available_backends()
    results: dict[str, dict[str, dict]] = {}
    total_retry_cost = 0.0

    def _retry_category(cat_key: str, field_names: list[str]) -> tuple[str, dict, float]:
        if cat_key not in _SNAKE_CAT_MAP:
            return cat_key, {}, 0.0
        cat_display, cat_model = _SNAKE_CAT_MAP[cat_key]
        field_list = ", ".join(field_names)

        retry_prompt = (
            f"\nFor the category '{cat_display}', extract only the fields defined "
            f"in the schema.\n\n"
            f"IMPORTANT — RETRY PASS: The following fields failed citation "
            f"verification in the first extraction attempt: {field_list}\n"
            "This means the evidence_quote was not found verbatim in the "
            "cited source_url, or the URL was wrong (e.g. you paraphrased or cited incorrectly).\n"
            "Please re-extract ONLY these fields with extreme care:\n"
            "  1. Use ONLY text that appears EXACTLY character-for-character verbatim in the source blocks. Do not paraphrase or edit the quote.\n"
            "  2. Set source_url to the EXACT URL shown in the SOURCE header.\n"
            "  3. If you cannot find reliable verbatim evidence, set value to null.\n"
            "Do NOT invent values or guess."
        )

        use_html = (cat_key == "tier_system")
        source_msg = _build_source_message(program_name, sources, use_html_tables=use_html)

        for backend in backends:
            provider = backend["provider"]
            model_name = backend["model"]
            try:
                client = backend["client"]()
            except Exception as exc:
                continue

            @retry(
                stop=stop_after_attempt(2),
                wait=wait_exponential(multiplier=1, min=2, max=10),
                reraise=True,
            )
            def _attempt():
                return client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": source_msg + retry_prompt},
                    ],
                    response_model=cat_model,
                )

            try:
                result_obj = _attempt()
                cost = _calculate_usage_cost(result_obj, provider)
                cat_dict = result_obj.model_dump()
                retried_res = {
                    f: cat_dict[f] for f in field_names if f in cat_dict
                }
                log.info("retry_extraction_done", category=cat_key, retried_fields=field_names, provider=provider, cost=cost)
                return cat_key, retried_res, cost
            except Exception as exc:
                log.error("retry_extraction_failed_for_backend", category=cat_key, provider=provider, error=str(exc)[:200])
                continue

        return cat_key, {}, 0.0

    # Run category retries in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(failed_fields) or 1) as executor:
        future_to_cat = {
            executor.submit(_retry_category, cat_key, field_names): cat_key
            for cat_key, field_names in failed_fields.items()
        }
        completed_count = 0
        for future in concurrent.futures.as_completed(future_to_cat):
            cat_key = future_to_cat[future]
            completed_count += 1
            try:
                _, cat_res, cost = future.result()
                total_retry_cost += cost
                if cat_res:
                    results[cat_key] = cat_res
                
                if program_id and main_loop:
                    from orchestrator.events import emit_event
                    import asyncio
                    progress_val = 0.70 + 0.08 * (completed_count / len(failed_fields))
                    asyncio.run_coroutine_threadsafe(
                        emit_event(
                            program_id,
                            "verifying",
                            progress_val,
                            f"Retried verification for category: {cat_key} ({completed_count}/{len(failed_fields)})"
                        ),
                        main_loop
                    )
            except Exception as exc:
                log.error("retry_future_failed", category=cat_key, error=str(exc))

    return results, total_retry_cost





