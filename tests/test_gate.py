"""Phase 2 Gate — unit tests.

Pure function tests — no marker needed (no API calls, no DB).
Decision #2: these always run in the default pytest invocation.

Run: pytest tests/test_gate.py -v
"""
import pytest
from backend.gate import gate_verify, gate_verify_batch, GATE_THRESHOLD, GateResult


# ---------------------------------------------------------------------------
# Test 1: Null claimed_value always passes (honest null = correct answer)
# ---------------------------------------------------------------------------

def test_null_value_always_passes():
    result = gate_verify(
        field_name="base_earn_rate",
        claimed_value=None,
        evidence_quote=None,
        source_raw_content="Some page content that doesn't matter.",
    )
    assert result.passed is True
    assert result.matched_value is None
    assert result.match_score == 1.0


# ---------------------------------------------------------------------------
# Test 2: Non-null with no evidence_quote → always rejects
# ---------------------------------------------------------------------------

def test_non_null_without_quote_rejects():
    result = gate_verify(
        field_name="base_earn_rate",
        claimed_value="2 points per $1",
        evidence_quote=None,
        source_raw_content="Earn 2 points per $1 on every purchase.",
    )
    assert result.passed is False
    assert result.matched_value is None
    assert "no evidence_quote" in result.rejection_reason


def test_non_null_with_empty_quote_rejects():
    result = gate_verify(
        field_name="base_earn_rate",
        claimed_value="2 points per $1",
        evidence_quote="   ",
        source_raw_content="Earn 2 points per $1 on every purchase.",
    )
    assert result.passed is False


# ---------------------------------------------------------------------------
# Test 3: Exact substring passes with high score
# ---------------------------------------------------------------------------

def test_exact_match_passes():
    source = "Earn 2 Stars per $1 spent at participating Starbucks stores."
    result = gate_verify(
        field_name="base_earn_rate",
        claimed_value="2 Stars per $1",
        evidence_quote="2 Stars per $1 spent at participating Starbucks stores",
        source_raw_content=source,
    )
    assert result.passed is True
    assert result.match_score >= 0.90
    assert result.matched_value == "2 Stars per $1"


# ---------------------------------------------------------------------------
# Test 4: Injected hallucination — quote not in source → rejects (DoD)
# ---------------------------------------------------------------------------

def test_hallucinated_quote_rejects():
    """Gate correctly rejects an injected hallucinated value — Phase 2 DoD."""
    real_source = (
        "Earn 2 Stars per $1 spent at participating Starbucks stores. "
        "Redeem 25 Stars for a free customization."
    )
    # This quote never appeared in the source
    hallucinated_quote = "Earn 10 Stars per $1 on all purchases including grocery stores"
    result = gate_verify(
        field_name="base_earn_rate",
        claimed_value="10 Stars per $1",
        evidence_quote=hallucinated_quote,
        source_raw_content=real_source,
    )
    assert result.passed is False
    assert result.matched_value is None
    assert result.match_score < GATE_THRESHOLD


# ---------------------------------------------------------------------------
# Test 5: Slightly paraphrased quote (minor whitespace/case diff) still passes
# ---------------------------------------------------------------------------

def test_minor_variation_passes():
    source = "Members earn TWO Stars for every $1.00 spent using a registered Starbucks Card."
    quote = "two stars for every $1.00 spent using a registered starbucks card"  # lowercase
    result = gate_verify(
        field_name="base_earn_rate",
        claimed_value="2 Stars per $1",
        evidence_quote=quote,
        source_raw_content=source,
    )
    assert result.passed is True


# ---------------------------------------------------------------------------
# Test 6: Empty source content → rejects
# ---------------------------------------------------------------------------

def test_empty_source_rejects():
    result = gate_verify(
        field_name="tier_names",
        claimed_value="Gold, Platinum",
        evidence_quote="Gold and Platinum tiers",
        source_raw_content="",
    )
    assert result.passed is False
    assert "empty" in result.rejection_reason


# ---------------------------------------------------------------------------
# Test 7: Custom threshold respected
# ---------------------------------------------------------------------------

def test_custom_threshold():
    source = "Earn points on every flight."
    quote = "earn points on every flight booking"  # partial match
    result_strict = gate_verify(
        field_name="earn_mechanics",
        claimed_value="points per flight",
        evidence_quote=quote,
        source_raw_content=source,
        threshold=0.99,  # very strict
    )
    result_loose = gate_verify(
        field_name="earn_mechanics",
        claimed_value="points per flight",
        evidence_quote=quote,
        source_raw_content=source,
        threshold=0.50,  # very loose
    )
    # strict may or may not pass, but loose should pass for a reasonable partial match
    assert result_loose.passed is True
    # Both should be deterministic (same inputs → same outputs)
    assert result_strict.passed == gate_verify(
        field_name="earn_mechanics",
        claimed_value="points per flight",
        evidence_quote=quote,
        source_raw_content=source,
        threshold=0.99,
    ).passed


# ---------------------------------------------------------------------------
# Test 8: Batch verify
# ---------------------------------------------------------------------------

def test_batch_verify():
    source = (
        "Earn 2 Stars per $1 spent. "
        "Redeem 25 Stars for a customization. "
        "Program is available in the US and Canada."
    )
    extractions = {
        "base_earn_rate": ("2 Stars per $1", "2 Stars per $1 spent"),
        "min_redemption": ("25 Stars", "Redeem 25 Stars for a customization"),
        "hallucinated_field": ("10 Stars", "Earn 10 Stars per $1 at all locations"),  # hallucination
        "null_field": (None, None),
    }
    results = gate_verify_batch(extractions, source)

    assert results["base_earn_rate"].passed is True
    assert results["min_redemption"].passed is True
    assert results["hallucinated_field"].passed is False
    assert results["null_field"].passed is True  # null always passes


# ---------------------------------------------------------------------------
# Test 9: Determinism — same inputs → byte-identical outputs
# ---------------------------------------------------------------------------

def test_gate_is_deterministic():
    source = "Earn 2 Stars per $1 on qualifying purchases at Starbucks stores."
    kwargs = dict(
        field_name="base_earn_rate",
        claimed_value="2 Stars per $1",
        evidence_quote="2 Stars per $1 on qualifying purchases",
        source_raw_content=source,
    )
    results = [gate_verify(**kwargs) for _ in range(5)]
    scores = [r.match_score for r in results]
    decisions = [r.passed for r in results]

    assert len(set(scores)) == 1, f"Score varied across runs: {scores}"
    assert len(set(decisions)) == 1, f"Decision varied across runs: {decisions}"
