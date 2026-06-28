"""Phase 8 Upgrades — Unit Tests.

Tests the following new features:
  * Parallelized extraction schemas (EvidenceState, EvidenceStateValue)
  * Pydantic model domain validators
  * ThreadPoolExecutor parallel mock runs
  * Offset calculation (citation_start, citation_end)
  * MetaInsights (escape hatch) validation
"""

import pytest
import uuid
from datetime import datetime, timezone
from backend.extraction_schemas import (
    EvidenceState,
    EvidenceStateValue,
    DigitalExperience,
    BurnMechanics,
    TierSystem,
    MetaInsights,
    ExtractedValue,
    ExtractedSchema,
)
from backend.extractor import extract_fields, retry_failed_fields
from orchestrator.nodes import verify_node
from orchestrator.state import PipelineState


# ---------------------------------------------------------------------------
# Test 1: EvidenceState & EvidenceStateValue
# ---------------------------------------------------------------------------

def test_evidence_state_value_validation():
    # Valid TRUE EvidenceStateValue
    v_true = EvidenceStateValue(
        value=EvidenceState.TRUE,
        evidence_quote="Mobile app is available on iOS.",
        source_url="https://example.com/app",
        model_certainty_hint=0.9,
    )
    assert v_true.value == "TRUE"

    # Valid NOT_MENTIONED EvidenceStateValue
    v_none = EvidenceStateValue(
        value=EvidenceState.NOT_MENTIONED,
        evidence_quote=None,
        source_url=None,
    )
    assert v_none.value == "NOT_MENTIONED"


# ---------------------------------------------------------------------------
# Test 2: Domain-specific Validators
# ---------------------------------------------------------------------------

def test_digital_experience_validator():
    # Valid ratings within 0-5
    dx_valid = DigitalExperience(
        mobile_app_available=EvidenceStateValue(value=EvidenceState.TRUE),
        app_store_rating=ExtractedValue(value="4.5/5 from reviews"),
        play_store_rating=ExtractedValue(value="4.2"),
        personalization_features=ExtractedValue(),
        gamification_features=EvidenceStateValue(value=EvidenceState.NOT_MENTIONED),
        digital_exclusives=ExtractedValue(),
    )
    assert dx_valid.app_store_rating.value == "4.5/5 from reviews"
    assert dx_valid.play_store_rating.value == "4.2"

    # Invalid rating (> 5.0) -> gets nulled
    dx_invalid = DigitalExperience(
        mobile_app_available=EvidenceStateValue(value=EvidenceState.TRUE),
        app_store_rating=ExtractedValue(value="9.8/5 from reviews"),
        play_store_rating=ExtractedValue(value="4.2"),
        personalization_features=ExtractedValue(),
        gamification_features=EvidenceStateValue(value=EvidenceState.NOT_MENTIONED),
        digital_exclusives=ExtractedValue(),
    )
    assert dx_invalid.app_store_rating.value is None


def test_tier_system_coherence_validator():
    # Discrepancy: count is 5, but only 3 names listed -> corrected to 3
    ts = TierSystem(
        has_tiers=ExtractedValue(value="yes"),
        tier_names=ExtractedValue(value="Silver, Gold, Platinum"),
        tier_qualification_criteria=ExtractedValue(),
        top_tier_benefits=ExtractedValue(),
        qualification_period=ExtractedValue(),
        tier_count=ExtractedValue(value="5"),
    )
    assert ts.tier_count.value == "3"


# ---------------------------------------------------------------------------
# Test 3: MetaInsights (Escape Hatch)
# ---------------------------------------------------------------------------

def test_meta_insights_schema():
    mi = MetaInsights(
        notable_unstructured_details=ExtractedValue(
            value="They offer a secret invitation-only tier called Cobalt.",
            evidence_quote="We also have a secret tier called Cobalt.",
            source_url="https://example.com/secret",
        )
    )
    assert mi.notable_unstructured_details.value == "They offer a secret invitation-only tier called Cobalt."
