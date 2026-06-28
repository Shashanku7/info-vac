"""Extraction Schemas — Pydantic models for all 44 loyalty-program fields.

Split from extractor.py to keep file sizes ≤ 500 lines.

Key additions vs. original:
  * EvidenceState enum  — three-way boolean: TRUE | FALSE | NOT_MENTIONED
  * EvidenceStateValue  — ExtractedValue subclass for boolean fields
  * MetaInsights        — 9th "escape hatch" category for unstructured notes
  * Domain validators   — TierSystem (tier_count coherence), DigitalExperience
                          (rating range), BurnMechanics (numeric point_value)
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Optional

import structlog
from pydantic import BaseModel, Field, model_validator

_log = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Three-way boolean enum
# ---------------------------------------------------------------------------

class EvidenceState(str, Enum):
    """Explicit three-way boolean for fields where absence of evidence matters.

    TRUE          — program explicitly has this feature (source-confirmed).
    FALSE         — program explicitly does NOT have this feature.
    NOT_MENTIONED — feature never mentioned in any source. Do NOT guess.
    """
    TRUE = "TRUE"
    FALSE = "FALSE"
    NOT_MENTIONED = "NOT_MENTIONED"


# ---------------------------------------------------------------------------
# Base field envelope — every extracted value carries its citation
# ---------------------------------------------------------------------------

class ExtractedValue(BaseModel):
    """One extracted field value with verbatim citation and model certainty."""

    value: Optional[str] = Field(
        None,
        description=(
            "The extracted value as a concise string. "
            "Set to null if the information is not found or cannot be verified."
        ),
    )
    evidence_quote: Optional[str] = Field(
        None,
        description=(
            "Exact verbatim quote — a character-for-character substring of the source. "
            "Required when value is non-null. Do NOT paraphrase."
        ),
    )
    source_url: Optional[str] = Field(
        None,
        description="URL of the source — must be the EXACT URL from the SOURCE header.",
    )
    model_certainty_hint: Optional[float] = Field(
        None, ge=0.0, le=1.0,
        description=(
            "Model's self-assessed certainty (0–1). "
            "NOT written to extracted_fields.confidence (Phase 3 owns that column)."
        ),
    )


class EvidenceStateValue(ExtractedValue):
    """ExtractedValue where `value` is constrained to EvidenceState.

    Used for fields where the distinction between 'definitely no' and
    'not mentioned' is analytically meaningful.
    Gate handling: EvidenceState serialises to its string name, which flows
    through the fuzzy-match gate unchanged.
    """

    value: Optional[EvidenceState] = Field(
        None,
        description=(
            "TRUE  — feature confirmed present. "
            "FALSE — feature confirmed absent. "
            "NOT_MENTIONED — no mention in any source (do NOT guess)."
        ),
    )


# ---------------------------------------------------------------------------
# Category 1 — Program Basics
# ---------------------------------------------------------------------------

class ProgramBasics(BaseModel):
    """Category 1: Program Basics"""
    program_name:     ExtractedValue = Field(description="Official name of the loyalty program")
    brand:            ExtractedValue = Field(description="Parent brand or company name")
    industry:         ExtractedValue = Field(description="Industry sector (airline, hotel, retail, grocery…)")
    program_type:     ExtractedValue = Field(description="Type of program (points, miles, cashback, tiered, hybrid)")
    geography:        ExtractedValue = Field(description="Primary geographic market(s) served")
    membership_count: ExtractedValue = Field(description="Reported number of members/participants")


# ---------------------------------------------------------------------------
# Category 2 — Partnerships
# ---------------------------------------------------------------------------

class Partnerships(BaseModel):
    """Category 2: Partnerships"""
    partner_names:       ExtractedValue = Field(description="Names of key earn/burn partners (comma-separated)")
    partnership_types:   ExtractedValue = Field(description="Nature of partnerships: earn-only, burn-only, or both")
    notable_partnerships:ExtractedValue = Field(description="Most significant or unique partnership details")
    airline_hotel_links: ExtractedValue = Field(description="Airline or hotel loyalty program transfer partnerships")
    partner_earn_rates:  ExtractedValue = Field(description="Points/miles earned per $ at partner locations")


# ---------------------------------------------------------------------------
# Category 3 — Earn Mechanics
# ---------------------------------------------------------------------------

class EarnMechanics(BaseModel):
    """Category 3: Earn Mechanics"""
    base_earn_rate:       ExtractedValue = Field(description="Base earning rate per dollar spent (e.g. '2 pts/$1')")
    bonus_categories:     ExtractedValue = Field(description="Categories with elevated earn rates and those rates")
    non_transactional_earn:ExtractedValue = Field(description="Ways to earn without purchasing (surveys, referrals…)")
    earn_cap:             ExtractedValue = Field(description="Any cap or limit on points earned per period")
    earning_currency:     ExtractedValue = Field(description="Name of the points/miles/cash-back currency earned")


# ---------------------------------------------------------------------------
# Category 4 — Digital Experience  (with rating validator)
# ---------------------------------------------------------------------------

class DigitalExperience(BaseModel):
    """Category 4: Digital Experience"""
    mobile_app_available:    EvidenceStateValue | ExtractedValue = Field(description="Whether a dedicated mobile app exists")
    app_store_rating:        ExtractedValue = Field(description="Apple App Store rating (e.g. '4.8/5 from 1.2M reviews')")
    play_store_rating:       ExtractedValue = Field(description="Google Play Store rating")
    personalization_features:ExtractedValue = Field(description="Personalized offers, recommendations, or targeting")
    gamification_features:   EvidenceStateValue | ExtractedValue = Field(description="Badges, challenges, streaks, or game-like elements")
    digital_exclusives:      ExtractedValue = Field(description="Benefits or earning only available via app/digital channel")

    @model_validator(mode="after")
    def validate_ratings(self) -> "DigitalExperience":
        """Null out store ratings whose parsed numeric value is outside 0–5."""
        for attr in ("app_store_rating", "play_store_rating"):
            ev = getattr(self, attr)
            if ev and ev.value:
                m = re.search(r"(\d+(?:\.\d+)?)", ev.value)
                if m:
                    rating_val = float(m.group(1))
                    if not (0.0 <= rating_val <= 5.0):
                        _log.warning("invalid_rating_range", field=attr, value=ev.value)
                        setattr(self, attr, ExtractedValue(value=None, evidence_quote=None))
        return self


# ---------------------------------------------------------------------------
# Category 5 — Burn Mechanics  (with point_value validator)
# ---------------------------------------------------------------------------

class BurnMechanics(BaseModel):
    """Category 5: Burn Mechanics"""
    redemption_options: ExtractedValue     = Field(description="What points/miles can be redeemed for")
    minimum_redemption: ExtractedValue     = Field(description="Minimum points/miles required to redeem")
    point_value_cents:  ExtractedValue     = Field(description="Estimated value per point/mile in US cents")
    expiry_policy:      ExtractedValue     = Field(description="When/how points expire")
    blackout_dates:     EvidenceStateValue | ExtractedValue = Field(description="Whether blackout/restriction dates apply to redemptions")
    transfer_options:   EvidenceStateValue | ExtractedValue = Field(description="Whether points can be transferred to other programs or people")

    @model_validator(mode="after")
    def validate_point_value(self) -> "BurnMechanics":
        """Log a warning when point_value_cents contains no numeric digit."""
        pv = self.point_value_cents
        if pv.value and not re.search(r"\d", pv.value):
            _log.warning("non_numeric_point_value", value=pv.value[:80])
        return self


# ---------------------------------------------------------------------------
# Category 6 — Member Sentiment
# ---------------------------------------------------------------------------

class MemberSentiment(BaseModel):
    """Category 6: Member Sentiment"""
    overall_rating:          ExtractedValue = Field(description="Aggregate member satisfaction rating if available")
    common_praise:           ExtractedValue = Field(description="Most frequently cited positive aspects from reviews")
    common_complaints:       ExtractedValue = Field(description="Most frequently cited negative aspects from reviews")
    nps_or_satisfaction:     ExtractedValue = Field(description="Net Promoter Score or satisfaction metric if published")
    sentiment_sources_checked:ExtractedValue = Field(description="Which review sources were consulted")


# ---------------------------------------------------------------------------
# Category 7 — Tier System  (with tier_count coherence validator)
# ---------------------------------------------------------------------------

class TierSystem(BaseModel):
    """Category 7: Tier System"""
    has_tiers:                ExtractedValue = Field(description="Whether the program has a tiered membership structure")
    tier_names:               ExtractedValue = Field(description="Names of all tiers from lowest to highest")
    tier_qualification_criteria:ExtractedValue = Field(description="Spend/activity required to reach/maintain each tier")
    top_tier_benefits:        ExtractedValue = Field(description="Key benefits of the highest tier")
    qualification_period:     ExtractedValue = Field(description="Period over which tier status is earned and renewed")
    tier_count:               ExtractedValue = Field(description="Number of distinct tiers in the program")

    @model_validator(mode="after")
    def validate_tier_consistency(self) -> "TierSystem":
        """Auto-correct tier_count when it contradicts the length of tier_names."""
        tc = self.tier_count
        tn = self.tier_names
        if not (tc.value and tn.value):
            return self
        try:
            count_int  = int(re.sub(r"[^\d]", "", tc.value.strip()))
            names_list = [n.strip() for n in re.split(r"[,;/]", tn.value) if n.strip()]
            if names_list and abs(count_int - len(names_list)) > 1:
                _log.warning(
                    "tier_count_mismatch",
                    count_field=count_int,
                    names_count=len(names_list),
                    auto_correcting=True,
                )
                self.tier_count = ExtractedValue(
                    value=str(len(names_list)),
                    evidence_quote=tc.evidence_quote,
                    source_url=tc.source_url,
                    model_certainty_hint=tc.model_certainty_hint,
                )
        except (ValueError, AttributeError):
            pass
        return self


# ---------------------------------------------------------------------------
# Category 8 — Competitive Position
# ---------------------------------------------------------------------------

class CompetitivePosition(BaseModel):
    """Category 8: Competitive Position"""
    key_differentiators: ExtractedValue = Field(description="What sets this program apart from competitors")
    weaknesses:          ExtractedValue = Field(description="Commonly cited weaknesses or limitations vs. competitors")
    closest_competitors: ExtractedValue = Field(description="Named competitor programs in the same category")
    market_position:     ExtractedValue = Field(description="Self-described or analyst-assessed market position")
    recent_changes:      ExtractedValue = Field(description="Significant recent program changes (devaluations, expansions…)")


# ---------------------------------------------------------------------------
# Category 9 — Meta Insights (escape hatch)
# ---------------------------------------------------------------------------

class MetaInsights(BaseModel):
    """Category 9: Meta / Escape Hatch — free-form notable details.

    Captures groundbreaking features, unusual mechanics, or important context
    that genuinely doesn't fit any of the 43 structured fields.
    The evidence_quote is verified by the gate like any other field.
    """
    notable_unstructured_details: ExtractedValue = Field(
        description=(
            "Free-form text (max 300 words) describing truly groundbreaking, "
            "unusual, or important features not captured in any other category. "
            "Set to null if nothing genuinely notable was found. "
            "Do NOT repeat information already captured elsewhere."
        )
    )


# ---------------------------------------------------------------------------
# Aggregate output schema — 44 fields across 9 categories
# ---------------------------------------------------------------------------

class ExtractedSchema(BaseModel):
    """Full extraction output for one loyalty program (44 fields, 9 categories)."""
    program_basics:      ProgramBasics
    partnerships:        Partnerships
    earn_mechanics:      EarnMechanics
    digital_experience:  DigitalExperience
    burn_mechanics:      BurnMechanics
    member_sentiment:    MemberSentiment
    tier_system:         TierSystem
    competitive_position:CompetitivePosition
    meta_insights:       MetaInsights = Field(
        default_factory=lambda: MetaInsights(
            notable_unstructured_details=ExtractedValue(value=None, evidence_quote=None)
        )
    )
    extraction_cost: Optional[float] = Field(0.0, description="Total API cost of this extraction run in USD")
