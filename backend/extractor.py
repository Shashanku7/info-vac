"""Extractor — Phase 2.

Extracts the 43-field loyalty program schema from fetched sources using
Instructor + Groq (llama-3.3-70b-versatile, primary) or Gemini-2.5-flash-lite
(fallback). Structured as 8 category-level Pydantic models — one Instructor
call per category — to avoid context overflow and make partial failures recoverable.

CRITICAL DESIGN RULE — confidence column ownership:
  This module outputs `model_certainty_hint: float | None` per field — the
  model's own assessment of certainty, used only as a low-weight tiebreaker.
  It NEVER writes to `extracted_fields.confidence`.
  That column is the exclusive property of Phase 3 (verifier.py):
      confidence = 0.5×corroboration + 0.3×authority + 0.2×recency
  If Phase 3 is skipped, `extracted_fields.confidence` stays NULL.

Content-sanitizer pattern (R11 — injection defense):
  Source content is passed inside the messages array as role='user' blocks
  labelled "SOURCE DATA:", never as instruction text. The system prompt
  contains only the extraction task definition. The model cannot mistake
  scraped content for instructions.
"""

from __future__ import annotations

import os
import warnings
from typing import Optional

# Suppress FutureWarning from google-generativeai — instructor still uses it
# internally (instructor >= 1.15). Remove when instructor migrates to google-genai.
warnings.filterwarnings("ignore", category=FutureWarning, module="google")

import instructor
import google.generativeai as genai

import structlog
from pydantic import BaseModel, Field

log = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Instructor client — Groq primary, Gemini fallback
# ---------------------------------------------------------------------------

def _make_client() -> tuple[instructor.Instructor, str]:
    """Return (instructor_client, model_name)."""
    api_key = os.environ.get("OLLAMA_API_KEY", "")
    if not api_key:
        raise ValueError("No LLM key found. Set OLLAMA_API_KEY in .env")

    model_name = "gemma4:31b-cloud"
    from openai import OpenAI
    
    # Use OpenAI client with Ollama cloud endpoint
    o_client = OpenAI(
        base_url="https://ollama.com/v1", 
        api_key=api_key,
    )

    client = instructor.from_openai(
        o_client,
        mode=instructor.Mode.JSON,
    )
    
    log.info("llm_backend", provider="ollama-cloud", model=model_name)
    return client, model_name


# ---------------------------------------------------------------------------
# Per-field envelope — every extracted value carries evidence + hint
# ---------------------------------------------------------------------------

class ExtractedValue(BaseModel):
    """One extracted field value with citation and model certainty hint."""
    value: Optional[str] = Field(
        None,
        description=(
            "The extracted value as a concise string. Set to null if the information "
            "is not found or cannot be verified in the provided source text."
        ),
    )
    evidence_quote: Optional[str] = Field(
        None,
        description=(
            "The exact verbatim quote from a source that supports this value. "
            "Must be a direct substring of the source text. Required when value is non-null."
        ),
    )
    source_url: Optional[str] = Field(
        None,
        description="URL of the source the evidence_quote was taken from.",
    )
    model_certainty_hint: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description=(
            "The model's self-assessed certainty (0.0-1.0). "
            "NOTE: This is a hint only and is NOT written to extracted_fields.confidence. "
            "Confidence is computed deterministically by Phase 3's formula."
        ),
    )


# ---------------------------------------------------------------------------
# Category schemas — 8 categories, matching infovac_ps.md exactly
# ---------------------------------------------------------------------------

class ProgramBasics(BaseModel):
    """Category 1: Program Basics"""
    program_name: ExtractedValue = Field(description="Official name of the loyalty program")
    brand: ExtractedValue = Field(description="Parent brand or company name")
    industry: ExtractedValue = Field(description="Industry sector (e.g., airline, hotel, retail, grocery)")
    program_type: ExtractedValue = Field(description="Type of program (points, miles, cashback, tiered, hybrid)")
    geography: ExtractedValue = Field(description="Primary geographic market(s) served")
    membership_count: ExtractedValue = Field(description="Reported number of members/participants")


class Partnerships(BaseModel):
    """Category 2: Partnerships"""
    partner_names: ExtractedValue = Field(description="Names of key earn/burn partners (comma-separated)")
    partnership_types: ExtractedValue = Field(description="Nature of partnerships: earn-only, burn-only, or both")
    notable_partnerships: ExtractedValue = Field(description="Most significant or unique partnership details")
    airline_hotel_links: ExtractedValue = Field(description="Any airline or hotel loyalty program transfer partnerships")
    partner_earn_rates: ExtractedValue = Field(description="Points/miles earned per $ at partner locations")


class EarnMechanics(BaseModel):
    """Category 3: Earn Mechanics"""
    base_earn_rate: ExtractedValue = Field(description="Base earning rate per dollar spent (e.g., '2 points per $1')")
    bonus_categories: ExtractedValue = Field(description="Categories with elevated earn rates and those rates")
    non_transactional_earn: ExtractedValue = Field(description="Ways to earn without purchasing (surveys, referrals, etc.)")
    earn_cap: ExtractedValue = Field(description="Any cap or limit on points earned per period")
    earning_currency: ExtractedValue = Field(description="Name of the points/miles/cash-back currency earned")


class DigitalExperience(BaseModel):
    """Category 4: Digital Experience"""
    mobile_app_available: ExtractedValue = Field(description="Whether a dedicated mobile app exists (yes/no)")
    app_store_rating: ExtractedValue = Field(description="Apple App Store rating (e.g., '4.8/5 from 1.2M reviews')")
    play_store_rating: ExtractedValue = Field(description="Google Play Store rating")
    personalization_features: ExtractedValue = Field(description="Personalized offers, recommendations, or targeting")
    gamification_features: ExtractedValue = Field(description="Badges, challenges, streaks, or game-like elements")
    digital_exclusives: ExtractedValue = Field(description="Benefits or earning only available via app/digital channel")


class BurnMechanics(BaseModel):
    """Category 5: Burn Mechanics"""
    redemption_options: ExtractedValue = Field(description="What points/miles can be redeemed for (list)")
    minimum_redemption: ExtractedValue = Field(description="Minimum points/miles required to redeem")
    point_value_cents: ExtractedValue = Field(description="Estimated value per point/mile in US cents")
    expiry_policy: ExtractedValue = Field(description="When/how points expire (e.g., 'expire after 12 months of inactivity')")
    blackout_dates: ExtractedValue = Field(description="Whether blackout or restriction dates apply to redemptions")
    transfer_options: ExtractedValue = Field(description="Whether points can be transferred to other programs or people")


class MemberSentiment(BaseModel):
    """Category 6: Member Sentiment"""
    overall_rating: ExtractedValue = Field(description="Aggregate member satisfaction rating if available")
    common_praise: ExtractedValue = Field(description="Most frequently cited positive aspects from reviews")
    common_complaints: ExtractedValue = Field(description="Most frequently cited negative aspects from reviews")
    nps_or_satisfaction: ExtractedValue = Field(description="Net Promoter Score or satisfaction metric if published")
    sentiment_sources_checked: ExtractedValue = Field(
        description="Which review sources were consulted (e.g., 'App Store, Reddit, Trustpilot')"
    )


class TierSystem(BaseModel):
    """Category 7: Tier System"""
    has_tiers: ExtractedValue = Field(description="Whether the program has a tiered membership structure (yes/no)")
    tier_names: ExtractedValue = Field(description="Names of all tiers from lowest to highest")
    tier_qualification_criteria: ExtractedValue = Field(
        description="Spend or activity required to reach/maintain each tier"
    )
    top_tier_benefits: ExtractedValue = Field(description="Key benefits of the highest tier")
    qualification_period: ExtractedValue = Field(description="Period over which tier status is earned and renewed")
    tier_count: ExtractedValue = Field(description="Number of distinct tiers in the program")


class CompetitivePosition(BaseModel):
    """Category 8: Competitive Position"""
    key_differentiators: ExtractedValue = Field(description="What sets this program apart from competitors")
    weaknesses: ExtractedValue = Field(description="Commonly cited weaknesses or limitations vs. competitors")
    closest_competitors: ExtractedValue = Field(description="Named competitor programs in the same category")
    market_position: ExtractedValue = Field(description="Self-described or analyst-assessed market position")
    recent_changes: ExtractedValue = Field(description="Significant recent program changes (devaluations, expansions, rebrands)")


# ---------------------------------------------------------------------------
# Aggregate output schema
# ---------------------------------------------------------------------------

class ExtractedSchema(BaseModel):
    """Full 43-field extraction output for one loyalty program."""
    program_basics: ProgramBasics
    partnerships: Partnerships
    earn_mechanics: EarnMechanics
    digital_experience: DigitalExperience
    burn_mechanics: BurnMechanics
    member_sentiment: MemberSentiment
    tier_system: TierSystem
    competitive_position: CompetitivePosition


# ---------------------------------------------------------------------------
# Content Sanitizer — injection defense
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a structured data extractor for loyalty program research.

Your task: extract specific fields from the SOURCE DATA blocks provided in this conversation.

Rules:
1. Only use information explicitly stated in the SOURCE DATA blocks. Do not use training knowledge.
2. For each field, provide the exact verbatim quote from the source that supports your answer.
3. If information is not found in the sources, set value to null and evidence_quote to null.
4. Do not invent, infer, or extrapolate beyond what is directly stated.
5. model_certainty_hint is your honest assessment of how confident you are given ONLY the sources provided.

The user's message will contain labelled SOURCE DATA blocks followed by the extraction request.
"""

def _build_source_message(program_name: str, sources: list) -> str:
    """Build the user message with sources as data blocks, NOT instructions.

    Content Sanitizer pattern: each source is labelled 'SOURCE DATA:' so the
    model treats it as data, not as part of the task instructions.
    """
    parts = [f"Extract loyalty program information for: {program_name}\n"]
    parts.append("=" * 60)
    parts.append("SOURCE DATA (use only these sources, do not use training knowledge):")
    parts.append("=" * 60)

    for i, source in enumerate(sources, 1):
        # Truncate very long sources to stay under 250k TPM free tier limit (keep first 4K chars)
        content = (source.raw_content or "")[:4000]
        parts.append(f"\n--- SOURCE {i}: [{source.source_type.upper()}] {source.url} ---")
        parts.append(content)
        parts.append(f"--- END SOURCE {i} ---")

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Extraction functions — one per category
# ---------------------------------------------------------------------------

def _extract_category(
    client: instructor.Instructor,
    model_name: str,
    response_model: type,
    program_name: str,
    sources: list,
    category_name: str,
) -> BaseModel | None:
    """Run one Instructor call for a single category. Returns None on failure."""
    source_msg = _build_source_message(program_name, sources)
    category_prompt = f"\nFor the category '{category_name}', extract only the fields defined in the schema."

    try:
        # Instructor for Gemini requires sending messages in the standard OpenAI format
        # but does not accept the 'model' kwarg in the create() method because the model
        # is already bound to the GenerativeModel during client creation.
        result = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": source_msg + category_prompt},
            ],
            response_model=response_model,
        )
        log.info("category_extracted", category=category_name, program=program_name)
        return result
    except Exception as exc:
        log.error(
            "category_extraction_failed",
            category=category_name,
            program=program_name,
            error=str(exc)[:300],
        )
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_CATEGORY_MAP: list[tuple[str, type]] = [
    ("Program Basics", ProgramBasics),
    ("Partnerships", Partnerships),
    ("Earn Mechanics", EarnMechanics),
    ("Digital Experience", DigitalExperience),
    ("Burn Mechanics", BurnMechanics),
    ("Member Sentiment", MemberSentiment),
    ("Tier System", TierSystem),
    ("Competitive Position", CompetitivePosition),
]


def extract_fields(
    program_name: str,
    sources: list,
) -> ExtractedSchema:
    """Extract all 43 fields across 8 categories from the provided sources.

    Args:
        program_name: Human-readable program name (e.g., "Delta SkyMiles")
        sources:      List of Source ORM objects with raw_content populated

    Returns:
        ExtractedSchema with all 8 category sub-models populated.
        Any category that fails its Instructor call returns all-null values.

    Note:
        model_certainty_hint values in the returned schema are NOT written to
        extracted_fields.confidence — that column is Phase 3's exclusive domain.
    """
    client, model_name = _make_client()

    log.info("extraction_start", program=program_name, source_count=len(sources), model=model_name)

    # Run each category extraction (sequential — rate-limit friendly)
    category_results: dict[str, BaseModel | None] = {}
    for cat_name, cat_model in _CATEGORY_MAP:
        result = _extract_category(client, model_name, cat_model, program_name, sources, cat_name)
        if result is None:
            # Fallback: all-null instance so the schema is always complete
            result = cat_model(
                **{
                    field_name: ExtractedValue(value=None, evidence_quote=None)
                    for field_name in cat_model.model_fields
                }
            )
        category_results[cat_name] = result

    schema = ExtractedSchema(
        program_basics=category_results["Program Basics"],
        partnerships=category_results["Partnerships"],
        earn_mechanics=category_results["Earn Mechanics"],
        digital_experience=category_results["Digital Experience"],
        burn_mechanics=category_results["Burn Mechanics"],
        member_sentiment=category_results["Member Sentiment"],
        tier_system=category_results["Tier System"],
        competitive_position=category_results["Competitive Position"],
    )

    # Count non-null fields for logging
    total = non_null = 0
    for cat_name, cat_model in _CATEGORY_MAP:
        cat_obj = getattr(schema, cat_name.lower().replace(" ", "_"))
        for fname in cat_model.model_fields:
            total += 1
            ev: ExtractedValue = getattr(cat_obj, fname)
            if ev.value is not None:
                non_null += 1

    log.info(
        "extraction_done",
        program=program_name,
        total_fields=total,
        non_null_fields=non_null,
        null_fields=total - non_null,
    )
    return schema
