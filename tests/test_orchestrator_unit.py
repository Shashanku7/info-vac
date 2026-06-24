"""Phase 4 orchestrator — unit tests (no live marker).

Tests:
  test_pipeline_emits_events_in_order  — monkeypatches emit_event+set_status,
      runs the graph with fake sources, asserts stage sequence.
  test_retry_on_timeout                — monkeypatches discover_sources to
      raise TimeoutError twice then return [], asserts retry fires 3× without crashing.

These tests never call Tavily, Firecrawl, Gemini, or Postgres.
Run: pytest tests/test_orchestrator_unit.py -v
"""
from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from orchestrator.state import PipelineState, iter_fields


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_state(**overrides) -> PipelineState:
    base: PipelineState = {
        "program_id": str(uuid.uuid4()),
        "program_name": "Test Program",
        "source_dicts": [],
        "extracted_schema": None,
        "error": None,
        "retry_count": 0,
    }
    return {**base, **overrides}


def _fake_source_dict(url: str = "https://example.com/faq") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "url": url,
        "source_type": "faq",
        "raw_content": "Earn 2 Stars per $1 spent at participating locations.",
        "fetch_method": "firecrawl",
        "fetched_at": "2026-06-21T00:00:00+00:00",
    }


# ---------------------------------------------------------------------------
# Test 1: SSE events fire in correct stage order
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pipeline_emits_events_in_order(monkeypatch):
    """Graph runs end-to-end (mocked DB + APIs) and events arrive in the
    expected sequence: retrieving → retrieved → extracting → extracted →
    verifying → verified → complete.
    """
    emitted: list[str] = []

    async def fake_emit(program_id, stage, progress, detail):
        emitted.append(stage)

    async def fake_set_status(program_id, status, error=None):
        pass

    # Fake sources returned by retriever
    fake_sources = [MagicMock(
        id=uuid.uuid4(),
        url="https://example.com/faq",
        source_type="faq",
        raw_content="Earn 2 Stars per $1 spent at Starbucks.",
        fetch_method="firecrawl",
        fetched_at=None,
    )]

    # Fake ExtractedSchema — all-null category (simplest valid output)
    from backend.extractor import (
        ExtractedSchema, ProgramBasics, Partnerships, EarnMechanics,
        DigitalExperience, BurnMechanics, MemberSentiment, TierSystem,
        CompetitivePosition, ExtractedValue,
    )
    _null = ExtractedValue(value=None, evidence_quote=None)
    fake_schema = ExtractedSchema(
        program_basics=ProgramBasics(
            program_name=_null, brand=_null, industry=_null,
            program_type=_null, geography=_null, membership_count=_null,
        ),
        partnerships=Partnerships(
            partner_names=_null, partnership_types=_null,
            notable_partnerships=_null, airline_hotel_links=_null,
            partner_earn_rates=_null,
        ),
        earn_mechanics=EarnMechanics(
            base_earn_rate=_null, bonus_categories=_null,
            non_transactional_earn=_null, earn_cap=_null, earning_currency=_null,
        ),
        digital_experience=DigitalExperience(
            mobile_app_available=_null, app_store_rating=_null,
            play_store_rating=_null, personalization_features=_null,
            gamification_features=_null, digital_exclusives=_null,
        ),
        burn_mechanics=BurnMechanics(
            redemption_options=_null, minimum_redemption=_null,
            point_value_cents=_null, expiry_policy=_null,
            blackout_dates=_null, transfer_options=_null,
        ),
        member_sentiment=MemberSentiment(
            overall_rating=_null, common_praise=_null,
            common_complaints=_null, nps_or_satisfaction=_null,
            sentiment_sources_checked=_null,
        ),
        tier_system=TierSystem(
            has_tiers=_null, tier_names=_null, tier_qualification_criteria=_null,
            top_tier_benefits=_null, qualification_period=_null, tier_count=_null,
        ),
        competitive_position=CompetitivePosition(
            key_differentiators=_null, weaknesses=_null, closest_competitors=_null,
            market_position=_null, recent_changes=_null,
        ),
    )

    monkeypatch.setattr("orchestrator.nodes.emit_event", fake_emit)
    monkeypatch.setattr("orchestrator.nodes.set_status", fake_set_status)
    monkeypatch.setattr(
        "orchestrator.nodes.discover_sources",
        AsyncMock(return_value=fake_sources),
    )
    monkeypatch.setattr(
        "orchestrator.nodes.extract_fields",
        MagicMock(return_value=fake_schema),
    )
    # Skip DB write in verify_node — patch make_background_session
    from contextlib import asynccontextmanager
    mock_session = AsyncMock()
    mock_session.flush = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.add = MagicMock()

    @asynccontextmanager
    async def fake_bg_session():
        yield mock_session

    monkeypatch.setattr("orchestrator.nodes.make_background_session", fake_bg_session)
    monkeypatch.setattr("orchestrator.events.AsyncSessionLocal", fake_bg_session)

    from orchestrator.graph import run_pipeline
    await run_pipeline(
        program_id=str(uuid.uuid4()),
        program_name="Test Program",
    )

    # Must contain the key stage transitions in order
    expected_order = [
        "retrieving", "retrieved",
        "extracting", "extracted",
        "verifying", "verified",
        "complete",
    ]
    # Check each expected stage is present and in sequence
    filtered = [s for s in emitted if s in expected_order]
    assert filtered == expected_order, (
        f"Stage order mismatch.\nExpected: {expected_order}\nGot:      {filtered}\n"
        f"Full emitted sequence: {emitted}"
    )


# ---------------------------------------------------------------------------
# Test 2: Retry fires on timeout, run succeeds on 3rd attempt
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_retry_on_timeout(monkeypatch):
    """discover_sources raises TimeoutError on attempts 1 and 2,
    succeeds on attempt 3. The pipeline must NOT crash, and retry_count
    must reflect that retries happened.
    """
    call_count = 0

    async def flaky_discover(program_name, program_id, db):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise TimeoutError(f"Simulated timeout on attempt {call_count}")
        return []  # success on 3rd attempt — empty but valid

    async def fake_emit(program_id, stage, progress, detail):
        pass  # discard events for this test

    async def fake_set_status(program_id, status, error=None):
        pass

    monkeypatch.setattr("orchestrator.nodes.emit_event", fake_emit)
    monkeypatch.setattr("orchestrator.nodes.set_status", fake_set_status)
    monkeypatch.setattr("orchestrator.nodes.discover_sources", flaky_discover)

    # Patch extract_fields to return null schema so we don't need Gemini
    from backend.extractor import (
        ExtractedSchema, ProgramBasics, Partnerships, EarnMechanics,
        DigitalExperience, BurnMechanics, MemberSentiment, TierSystem,
        CompetitivePosition, ExtractedValue,
    )
    _null = ExtractedValue()
    null_cat_kwargs = lambda model: {f: _null for f in model.model_fields}
    fake_schema = ExtractedSchema(
        program_basics=ProgramBasics(**null_cat_kwargs(ProgramBasics)),
        partnerships=Partnerships(**null_cat_kwargs(Partnerships)),
        earn_mechanics=EarnMechanics(**null_cat_kwargs(EarnMechanics)),
        digital_experience=DigitalExperience(**null_cat_kwargs(DigitalExperience)),
        burn_mechanics=BurnMechanics(**null_cat_kwargs(BurnMechanics)),
        member_sentiment=MemberSentiment(**null_cat_kwargs(MemberSentiment)),
        tier_system=TierSystem(**null_cat_kwargs(TierSystem)),
        competitive_position=CompetitivePosition(**null_cat_kwargs(CompetitivePosition)),
    )
    monkeypatch.setattr("orchestrator.nodes.extract_fields", MagicMock(return_value=fake_schema))

    from contextlib import asynccontextmanager
    mock_session = AsyncMock()
    mock_session.flush = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.add = MagicMock()

    @asynccontextmanager
    async def fake_bg_session():
        yield mock_session

    monkeypatch.setattr("orchestrator.nodes.make_background_session", fake_bg_session)
    monkeypatch.setattr("orchestrator.events.AsyncSessionLocal", fake_bg_session)

    from orchestrator.graph import run_pipeline
    # Must not raise
    await run_pipeline(
        program_id=str(uuid.uuid4()),
        program_name="Retry Test Program",
    )

    assert call_count == 3, (
        f"Expected discover_sources to be called 3 times (2 failures + 1 success), "
        f"got {call_count}"
    )


# ---------------------------------------------------------------------------
# Test 3: iter_fields correctly flattens schema dict
# ---------------------------------------------------------------------------

def test_iter_fields_flattens_all_categories():
    """iter_fields must return every category×field combination."""
    schema_dict = {
        "program_basics": {
            "program_name": {"value": "Test", "evidence_quote": "Test"},
            "brand": {"value": None, "evidence_quote": None},
        },
        "earn_mechanics": {
            "base_earn_rate": {"value": "2x", "evidence_quote": "earn 2x"},
        },
        "_meta_ignored": "not a dict — should be skipped",
    }
    rows = iter_fields(schema_dict)
    assert len(rows) == 3
    cats = {r[0] for r in rows}
    assert cats == {"program_basics", "earn_mechanics"}
    field_names = {r[1] for r in rows}
    assert field_names == {"program_name", "brand", "base_earn_rate"}


# ---------------------------------------------------------------------------
# Test 4: Short-circuit — error in state skips downstream nodes
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_error_state_short_circuits(monkeypatch):
    """If state has error set, extract/verify/narrate must not call Gemini or DB."""
    extract_called = []

    async def fake_emit(*a, **k):
        pass

    async def fake_set_status(*a, **k):
        pass

    monkeypatch.setattr("orchestrator.nodes.emit_event", fake_emit)
    monkeypatch.setattr("orchestrator.nodes.set_status", fake_set_status)

    def spy_extract(*a, **k):
        extract_called.append(True)
        raise AssertionError("extract_fields should not be called when error is set")

    monkeypatch.setattr("orchestrator.nodes.extract_fields", spy_extract)

    from orchestrator.nodes import extract_node, verify_node, narrate_node
    error_state = _make_state(error="upstream failure")

    result = await extract_node(error_state)
    assert result["error"] == "upstream failure"
    assert not extract_called, "extract_fields was called despite error state"

    result2 = await verify_node(error_state)
    assert result2["error"] == "upstream failure"

    result3 = await narrate_node(error_state)
    assert result3["error"] == "upstream failure"
