"""Comparator unit tests — Phase 6.

Fast tests: no @pytest.mark.live, no real DB, no real API calls.
All LLM and DB interactions are mocked.
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.comparator import (
    MarketMatrixOutput,
    _SYSTEM_PROMPT,
    _build_comparison_context_multi,
    compare_programs,
)


# ---------------------------------------------------------------------------
# Helpers — fake ORM objects
# ---------------------------------------------------------------------------

def _make_field(
    field_name: str,
    field_value: str,
    gate_passed: bool = True,
    is_null: bool = False,
    category: str = "earn_mechanics",
    source_id: str | None = None,
) -> MagicMock:
    f = MagicMock()
    f.field_name = field_name
    f.field_value = field_value
    f.gate_passed = gate_passed
    f.is_null = is_null
    f.category = category
    f.source_id = uuid.UUID(source_id) if source_id else None
    return f


def _make_comparison_output() -> dict:
    """Return a valid MarketMatrixOutput as dict for mocking."""
    return {
        "executive_summary": "Program A is stronger overall.",
        "matrix": [
            {
                "category": "Earn Mechanics",
                "rankings": ["Program A", "Program B"],
                "rationale": "A has higher base rate (source: https://a.com)"
            }
        ],
        "strategic_recommendations": "Program A is recommended for value seekers.",
    }


def _make_client_stub(analysis_dict: dict):
    """Return a (client, model_name) tuple where client returns a MarketMatrixOutput."""
    result = MagicMock()
    result.model_dump.return_value = analysis_dict
    client = MagicMock()
    client.chat.completions.create.return_value = result
    return client, "stub-model"


# ---------------------------------------------------------------------------
# Test 1: Only gate-passed, non-null fields appear in the context block
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_only_gate_passed_in_context():
    """Rejected and null fields must not appear in the grounded data block."""
    good = _make_field("base_earn_rate", "2 points per $1", gate_passed=True, is_null=False)
    rejected = _make_field("bonus_categories", "5x on dining", gate_passed=False, is_null=False)
    null_field = _make_field("earn_cap", None, gate_passed=True, is_null=True)

    context = await _build_comparison_context_multi(
        [
            {"name": "Program A", "fields": [good, rejected, null_field]},
            {"name": "Program B", "fields": [good]}
        ],
        {},
    )

    assert "base_earn_rate" in context
    assert "bonus_categories" not in context
    assert "earn_cap" not in context


# ---------------------------------------------------------------------------
# Test 2: Both programs present in context
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_both_programs_present_in_context():
    """Context block must contain labelled sections for both programs."""
    field_a = _make_field("base_earn_rate", "2 points per $1", category="earn_mechanics")
    field_b = _make_field("base_earn_rate", "3 points per $1", category="earn_mechanics")

    context = await _build_comparison_context_multi(
        [
            {"name": "Starbucks Rewards", "fields": [field_a]},
            {"name": "Delta SkyMiles", "fields": [field_b]}
        ],
        {},
    )

    assert "PROGRAM: Starbucks Rewards" in context
    assert "PROGRAM: Delta SkyMiles" in context
    assert "2 points per $1" in context
    assert "3 points per $1" in context


# ---------------------------------------------------------------------------
# Test 3: compare_programs() stores a Comparison row
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_comparison_stored_in_db():
    """compare_programs() should add exactly one Comparison to the session."""
    program_a_id = str(uuid.uuid4())
    program_b_id = str(uuid.uuid4())
    source_id = str(uuid.uuid4())

    fake_field = _make_field(
        "base_earn_rate", "2 points per $1",
        gate_passed=True, is_null=False,
        category="earn_mechanics", source_id=source_id,
    )

    fake_source = MagicMock()
    fake_source.id = uuid.UUID(source_id)
    fake_source.url = "https://example.com/tnc"

    fake_program_a = MagicMock()
    fake_program_a.name = "Program A"
    fake_program_b = MagicMock()
    fake_program_b.name = "Program B"

    # Mock DB session
    session = AsyncMock()

    # session.get returns program objects based on which UUID is passed
    def get_side_effect(model, pid):
        if str(pid) == program_a_id:
            return fake_program_a
        return fake_program_b

    session.get.side_effect = get_side_effect

    # Two execute calls per program: fields query + sources query = 4 total
    fields_result = MagicMock()
    fields_result.scalars.return_value.all.return_value = [fake_field]

    sources_result = MagicMock()
    sources_result.scalars.return_value.all.return_value = [fake_source]

    session.execute.side_effect = [
        fields_result, sources_result,  # Program A
        fields_result, sources_result,  # Program B
    ]
    session.flush = AsyncMock()

    # Mock LLM
    analysis = _make_comparison_output()

    with patch("backend.comparator._make_client", return_value=_make_client_stub(analysis)), \
         patch("asyncio.get_running_loop") as mock_loop:
        loop = MagicMock()
        mock_loop.return_value = loop

        async def fake_executor(executor, fn, *args):
            return fn(*args)

        loop.run_in_executor = fake_executor

        comparison = await compare_programs([program_a_id, program_b_id], session)

    assert comparison is not None
    session.add.assert_called_once()
    session.flush.assert_called_once()

    added = session.add.call_args[0][0]
    assert hasattr(added, "analysis_json")
    assert added.analysis_json is not None


# ---------------------------------------------------------------------------
# Test 4: System prompt contains grounding constraint
# ---------------------------------------------------------------------------

def test_system_prompt_contains_grounding():
    """The system prompt must explicitly forbid training-knowledge use."""
    grounding_phrases = [
        "do not use",
        "training",
        "grounded data",
        "only use",
    ]
    lower = _SYSTEM_PROMPT.lower()
    assert any(phrase in lower for phrase in grounding_phrases), (
        f"System prompt missing grounding constraint.\nPrompt:\n{_SYSTEM_PROMPT}"
    )


# ---------------------------------------------------------------------------
# Test 5: LLM failure → compare_programs returns None gracefully
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_llm_failure_returns_none():
    """If the LLM call raises any exception, compare_programs returns None."""
    program_a_id = str(uuid.uuid4())
    program_b_id = str(uuid.uuid4())

    session = AsyncMock()
    session.get.return_value = MagicMock(name="Test Program")

    # Session returns empty field list
    fields_result = MagicMock()
    fields_result.scalars.return_value.all.return_value = []
    session.execute.return_value = fields_result

    # _make_client raises to simulate LLM failure
    with patch("backend.comparator._make_client", side_effect=RuntimeError("LLM unavailable")):
        result = await compare_programs([program_a_id, program_b_id], session)

    assert result is None


# ---------------------------------------------------------------------------
# Test 6: Empty program data handled gracefully
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_program_handled():
    """If one program has no extracted fields, context still builds without crash."""
    field_a = _make_field("base_earn_rate", "2 points per $1", category="earn_mechanics")

    context = await _build_comparison_context_multi(
        [
            {"name": "Program A", "fields": [field_a]},
            {"name": "Program B", "fields": []}
        ],
        {},
    )

    assert "PROGRAM: Program A" in context
    assert "PROGRAM: Program B" in context
    assert "No verified data available" in context
    assert "base_earn_rate" in context
