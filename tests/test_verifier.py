"""Phase 3 Verifier — unit tests.

Pure function tests — no marker needed (no API calls, no DB, no Gemini).
Decision #2: these always run in the default pytest invocation.

DoD:
  1. Fixture inputs with known corroboration/authority/recency → formula output
     matches hand-calculated expected value exactly
  2. Two sources with conflicting values → contradiction_flag=True, confidence ≤ 0.4
  3. Run formula twice on identical input → byte-identical output (determinism)

Run: pytest tests/test_verifier.py -v
"""
import pytest
from datetime import datetime, timedelta, timezone

from backend.verifier import (
    compute_confidence,
    VerifierResult,
    SourceEvidence,
    AUTHORITY_WEIGHTS,
    _CONTRADICTION_CONFIDENCE_CAP,
    _recency_score,
)


# ---------------------------------------------------------------------------
# Helper: build a SourceEvidence with a known fetched_at offset
# ---------------------------------------------------------------------------

def _evidence(
    source_id: str = "src-1",
    source_type: str = "faq",
    field_value: str = "2 Stars per $1",
    age_days: float = 0.0,
) -> SourceEvidence:
    fetched_at = datetime.now(timezone.utc) - timedelta(days=age_days)
    return SourceEvidence(
        source_id=source_id,
        source_type=source_type,
        field_value=field_value,
        fetched_at=fetched_at,
    )


# ---------------------------------------------------------------------------
# Test 1: Formula output matches hand-calculated value exactly (DoD #1)
# ---------------------------------------------------------------------------

def test_formula_matches_hand_calculation():
    """
    Scenario:
      - 2 sources, total_sources=10
      - Both are 'faq' type (authority=0.8)
      - Both fetched today (recency=1.0)

    Hand calculation:
      corroboration = 2/10 = 0.2
      authority     = 0.8  (faq weight)
      recency       = 1.0  (fetched today)
      confidence    = 0.5×0.2 + 0.3×0.8 + 0.2×1.0
                    = 0.10 + 0.24 + 0.20
                    = 0.54
    """
    evidences = [
        _evidence("src-1", "faq", "2 Stars per $1", age_days=0),
        _evidence("src-2", "faq", "2 Stars per $1", age_days=1),
    ]
    result = compute_confidence(evidences, total_sources=10)

    assert result.corroboration_score == pytest.approx(0.2, abs=0.001)
    assert result.authority_score == pytest.approx(0.8, abs=0.001)
    assert result.recency_score == pytest.approx(1.0, abs=0.001)
    assert result.confidence == pytest.approx(0.54, abs=0.001)
    assert result.contradiction_flag is False


def test_formula_with_mixed_authority():
    """
    Scenario:
      - 1 tnc source (authority=1.0) + 1 forum source (authority=0.5)
      - total_sources=4
      - Both fetched today (recency=1.0)

    Hand calculation:
      corroboration = 2/4 = 0.5
      authority     = (1.0 + 0.5) / 2 = 0.75
      recency       = 1.0
      confidence    = 0.5×0.5 + 0.3×0.75 + 0.2×1.0
                    = 0.25 + 0.225 + 0.20
                    = 0.675
    """
    evidences = [
        _evidence("src-1", "tnc", "12-month inactivity", age_days=0),
        _evidence("src-2", "forum", "12-month inactivity", age_days=0),
    ]
    result = compute_confidence(evidences, total_sources=4)

    assert result.corroboration_score == pytest.approx(0.5, abs=0.001)
    assert result.authority_score == pytest.approx(0.75, abs=0.001)
    assert result.confidence == pytest.approx(0.675, abs=0.001)


def test_formula_with_stale_source():
    """
    Scenario:
      - 1 press source (authority=0.9), 500 days old (past _STALE_DAYS → recency=0.3)
      - total_sources=5

    Hand calculation:
      corroboration = 1/5 = 0.2
      authority     = 0.9
      recency       = 0.3 (stale floor)
      confidence    = 0.5×0.2 + 0.3×0.9 + 0.2×0.3
                    = 0.10 + 0.27 + 0.06
                    = 0.43
    """
    evidences = [_evidence("src-1", "press", "some value", age_days=500)]
    result = compute_confidence(evidences, total_sources=5)

    assert result.corroboration_score == pytest.approx(0.2, abs=0.001)
    assert result.authority_score == pytest.approx(0.9, abs=0.001)
    assert result.recency_score == pytest.approx(0.3, abs=0.001)
    assert result.confidence == pytest.approx(0.43, abs=0.001)


# ---------------------------------------------------------------------------
# Test 2: No evidence → confidence = 0.0
# ---------------------------------------------------------------------------

def test_no_evidence_returns_zero_confidence():
    result = compute_confidence(evidences=[], total_sources=10)
    assert result.confidence == 0.0
    assert result.corroboration_score == 0.0
    assert result.contradiction_flag is False


# ---------------------------------------------------------------------------
# Test 3: Contradiction detection + confidence cap (DoD #2)
# ---------------------------------------------------------------------------

def test_contradiction_detected_and_confidence_capped():
    """
    Two sources with clearly conflicting values → contradiction_flag=True,
    confidence ≤ 0.4 (DoD requirement).
    """
    evidences = [
        _evidence("src-1", "tnc", "Points expire after 12 months of inactivity", age_days=10),
        _evidence("src-2", "faq", "Points never expire as long as account is active", age_days=5),
    ]
    result = compute_confidence(evidences, total_sources=5)

    assert result.contradiction_flag is True
    assert result.contradiction_note is not None
    assert result.confidence <= _CONTRADICTION_CONFIDENCE_CAP, (
        f"Contradicted field confidence {result.confidence} exceeds cap {_CONTRADICTION_CONFIDENCE_CAP}"
    )


def test_identical_values_no_contradiction():
    """Same value from multiple sources → no contradiction."""
    evidences = [
        _evidence("src-1", "faq", "25 Stars minimum redemption", age_days=0),
        _evidence("src-2", "tnc", "25 Stars minimum redemption", age_days=2),
        _evidence("src-3", "press", "25 stars minimum", age_days=5),
    ]
    result = compute_confidence(evidences, total_sources=8)
    assert result.contradiction_flag is False


def test_single_source_no_contradiction():
    """One source cannot contradict itself."""
    evidences = [_evidence("src-1", "tnc", "2 miles per $1", age_days=0)]
    result = compute_confidence(evidences, total_sources=3)
    assert result.contradiction_flag is False


# ---------------------------------------------------------------------------
# Test 4: Determinism — byte-identical output on identical input (DoD #3)
# ---------------------------------------------------------------------------

def test_compute_confidence_is_deterministic():
    """
    Run formula twice on identical input → results must be byte-identical.
    This is the regression test that proves the determinism design goal holds.
    If this ever fails, something non-deterministic leaked into a stage that
    must be pure code.
    """
    # Use fixed datetime to avoid any clock-based variance
    fixed_time = datetime(2026, 6, 21, 10, 0, 0, tzinfo=timezone.utc)
    evidences = [
        SourceEvidence("src-1", "tnc", "2 Stars per $1", fetched_at=fixed_time),
        SourceEvidence("src-2", "faq", "2 Stars per $1", fetched_at=fixed_time - timedelta(days=10)),
        SourceEvidence("src-3", "forum", "2 stars per dollar", fetched_at=fixed_time - timedelta(days=30)),
    ]
    total_sources = 15

    results = [compute_confidence(list(evidences), total_sources) for _ in range(10)]

    confidences = [r.confidence for r in results]
    corroborations = [r.corroboration_score for r in results]
    authorities = [r.authority_score for r in results]
    recencies = [r.recency_score for r in results]
    contradictions = [r.contradiction_flag for r in results]

    assert len(set(confidences)) == 1, f"confidence varied: {set(confidences)}"
    assert len(set(corroborations)) == 1, f"corroboration varied: {set(corroborations)}"
    assert len(set(authorities)) == 1, f"authority varied: {set(authorities)}"
    assert len(set(recencies)) == 1, f"recency varied: {set(recencies)}"
    assert len(set(contradictions)) == 1, f"contradiction_flag varied: {set(contradictions)}"


# ---------------------------------------------------------------------------
# Test 5: Recency helper function
# ---------------------------------------------------------------------------

def test_recency_fresh_source():
    now = datetime.now(timezone.utc)
    score = _recency_score(now - timedelta(days=5))
    assert score == 1.0


def test_recency_stale_source():
    old = datetime.now(timezone.utc) - timedelta(days=400)
    score = _recency_score(old)
    assert score == pytest.approx(0.3, abs=0.001)


def test_recency_none_returns_floor():
    score = _recency_score(None)
    assert score == pytest.approx(0.3, abs=0.001)


def test_recency_midpoint():
    """Source at midpoint between FRESH_DAYS and STALE_DAYS → midpoint score."""
    # Midpoint = (30 + 365) / 2 = 197.5 days → recency = (1.0 + 0.3) / 2 = 0.65
    mid_days = (30 + 365) / 2
    score = _recency_score(datetime.now(timezone.utc) - timedelta(days=mid_days))
    assert score == pytest.approx(0.65, abs=0.01)


# ---------------------------------------------------------------------------
# Test 6: Authority weights coverage
# ---------------------------------------------------------------------------

def test_all_source_types_have_authority_weight():
    """Every source_type used in Phase 1 must have an authority weight."""
    phase1_types = {"faq", "tnc", "app_review", "press", "news", "forum"}
    for stype in phase1_types:
        assert stype in AUTHORITY_WEIGHTS, f"Missing authority weight for source_type={stype!r}"


def test_authority_weights_in_valid_range():
    for stype, weight in AUTHORITY_WEIGHTS.items():
        assert 0.0 <= weight <= 1.0, f"{stype} weight {weight} out of [0, 1]"
