"""Narrator unit tests — Phase 5.

Fast tests: no @pytest.mark.live, no real DB, no real API calls.
All LLM and DB interactions are mocked.

Tests:
  1. test_only_gate_passed_in_context       — rejected/null fields excluded from context block
  2. test_word_count_retry_triggered        — <200 word response triggers exactly one re-request
  3. test_word_count_stored_as_is_after_retry — after 2 attempts still OOB, stored anyway
  4. test_narrative_written_to_db           — generate_narrative() adds Narrative to session
  5. test_system_prompt_contains_grounding  — system prompt contains the no-training-knowledge rule
  6. test_llm_failure_returns_none          — Instructor raising returns None gracefully
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.narrator import (
    NarrativeOutput,
    _SYSTEM_PROMPT,
    _build_context,
    _call_narrator,
    generate_narrative,
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


def _make_client_stub(brief: str):
    """Return a (client, model_name) tuple where client.chat.completions.create returns brief."""
    result = MagicMock()
    result.brief = brief
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

    context = await _build_context("Test Program", [good, rejected, null_field], {})

    assert "base_earn_rate" in context
    assert "bonus_categories" not in context
    assert "earn_cap" not in context


# ---------------------------------------------------------------------------
# Test 2: Word count out-of-range triggers exactly one retry
# ---------------------------------------------------------------------------

def test_word_count_retry_triggered():
    """If first response is too short (<200 words), create is called a second time."""
    short_brief = "Too short."  # well under 200 words
    normal_brief = " ".join(["word"] * 600)  # 600 words — in range

    call_count = 0

    def side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        result = MagicMock()
        result.brief = short_brief if call_count == 1 else normal_brief
        return result

    client = MagicMock()
    client.chat.completions.create.side_effect = side_effect

    brief = _call_narrator(client, "stub-model", "GROUNDED DATA: ...", "Test Program")

    assert call_count == 2, "Should have called create exactly twice"
    assert brief == normal_brief


# ---------------------------------------------------------------------------
# Test 3: Word count stored as-is after both attempts fail
# ---------------------------------------------------------------------------

def test_word_count_stored_as_is_after_retry():
    """If both attempts are OOB, the second brief is returned (not an error raised)."""
    short_brief = "Still too short."  # <200 both times

    result = MagicMock()
    result.brief = short_brief
    client = MagicMock()
    client.chat.completions.create.return_value = result

    # Should not raise — just return the short brief and log a warning
    brief = _call_narrator(client, "stub-model", "GROUNDED DATA: ...", "Test Program")

    assert isinstance(brief, str)
    assert brief == short_brief


# ---------------------------------------------------------------------------
# Test 4: generate_narrative() inserts a Narrative row into the session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_narrative_written_to_db():
    """generate_narrative() should add exactly one Narrative to the session."""
    program_id = str(uuid.uuid4())
    source_id = str(uuid.uuid4())

    fake_field = _make_field(
        "base_earn_rate", "2 points per $1",
        gate_passed=True, is_null=False,
        category="earn_mechanics", source_id=source_id,
    )

    fake_source = MagicMock()
    fake_source.id = uuid.UUID(source_id)
    fake_source.url = "https://example.com/tnc"

    fake_program = MagicMock()
    fake_program.name = "Test Program"

    # Mock DB session
    session = AsyncMock()
    session.get.return_value = fake_program

    fields_scalars = MagicMock()
    fields_scalars.scalars.return_value.all.return_value = [fake_field]

    sources_scalars = MagicMock()
    sources_scalars.scalars.return_value.all.return_value = [fake_source]

    scraped_scalars = MagicMock()
    scraped_scalars.scalars.return_value.all.return_value = [fake_source]

    session.execute.side_effect = [fields_scalars, sources_scalars, scraped_scalars]
    session.flush = AsyncMock()

    # Mock LLM — 600 words in range
    good_brief = " ".join(["word"] * 600)

    with patch("backend.narrator._make_client", return_value=_make_client_stub(good_brief)), \
         patch("asyncio.get_running_loop") as mock_loop:
        loop = MagicMock()
        mock_loop.return_value = loop

        # run_in_executor should call the passed function
        async def fake_executor(executor, fn, *args):
            return fn(*args)

        loop.run_in_executor = fake_executor

        narrative = await generate_narrative(program_id, session)

    assert narrative is not None
    session.add.assert_called_once()
    session.flush.assert_called_once()

    added = session.add.call_args[0][0]
    assert hasattr(added, "narrative_text")
    assert added.word_count == 600


# ---------------------------------------------------------------------------
# Test 5: System prompt contains the grounding constraint
# ---------------------------------------------------------------------------

def test_system_prompt_contains_grounding():
    """The system prompt must explicitly forbid training-knowledge use."""
    # Any of these phrases indicates the no-outside-knowledge constraint
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
# Test 6: LLM failure → generate_narrative returns None gracefully
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_llm_failure_returns_none():
    """If the LLM call raises any exception, generate_narrative returns None."""
    program_id = str(uuid.uuid4())
    session = AsyncMock()
    session.get.return_value = MagicMock(name="Test Program")

    # Session returns empty field list
    fields_result = MagicMock()
    fields_result.scalars.return_value.all.return_value = []
    session.execute.return_value = fields_result

    # _make_client raises to simulate LLM failure
    with patch("backend.narrator._make_client", side_effect=RuntimeError("LLM unavailable")):
        result = await generate_narrative(program_id, session)

    assert result is None
