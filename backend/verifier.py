"""Verifier — Phase 3.

Deterministic confidence formula and contradiction detection.
This is the ONLY component that writes to `extracted_fields.confidence`.

Formula (from infovac_solution.md):
    confidence = 0.5 × corroboration + 0.3 × authority + 0.2 × recency

Sub-scores:
  corroboration = (distinct sources supporting this value) / (total sources)  [capped at 1.0]
  authority     = weighted average of source_type tier scores (see AUTHORITY_WEIGHTS)
  recency       = sigmoid decay based on age of the most recent supporting source

Contradiction detection:
  Two or more gate-verified values for the same field that don't fuzzy-match each other
  → contradiction_flag = True, confidence capped at 0.4

The Verifier is deterministic code, not an LLM call. This is deliberate — it is the
final trustworthy check before confidence numbers are shown to users or judges.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Optional

from rapidfuzz import fuzz
import structlog

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Authority weights — source type tier scores
# From infovac_solution.md "authority" definition
# ---------------------------------------------------------------------------

AUTHORITY_WEIGHTS: dict[str, float] = {
    "tnc":        1.0,   # Terms & Conditions — primary source
    "press":      0.9,   # Official press releases
    "faq":        0.8,   # Official FAQ / help pages
    "news":       0.7,   # News coverage
    "app_review": 0.6,   # App store listings and reviews
    "forum":      0.5,   # Community forums (Reddit, Quora, etc.)
    "homepage":   0.7,   # Default for unclassified official pages
}
_DEFAULT_AUTHORITY = 0.5  # Unknown/uncategorized source type


# ---------------------------------------------------------------------------
# Recency decay parameters
# ---------------------------------------------------------------------------

# Age (in days) at which recency score = 1.0
_FRESH_DAYS = 30
# Age (in days) at which recency score approaches its floor
_STALE_DAYS = 365
# Floor value for very old sources
_RECENCY_FLOOR = 0.3


def _recency_score(fetched_at: Optional[datetime]) -> float:
    """Sigmoid-like decay: 1.0 for fresh sources, floor for stale ones.

    Uses a simple linear interpolation clamped between RECENCY_FLOOR and 1.0.
    For Phase 8 calibration: replace linear with exp decay if the eval set
    shows non-linear aging effects.
    """
    if fetched_at is None:
        return _RECENCY_FLOOR

    now = datetime.now(timezone.utc)
    # Ensure fetched_at is timezone-aware
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)

    age_days = max(0.0, (now - fetched_at).total_seconds() / 86400.0)

    if age_days <= _FRESH_DAYS:
        return 1.0
    if age_days >= _STALE_DAYS:
        return _RECENCY_FLOOR

    # Linear decay from 1.0 at FRESH_DAYS to RECENCY_FLOOR at STALE_DAYS
    fraction = (age_days - _FRESH_DAYS) / (_STALE_DAYS - _FRESH_DAYS)
    return round(1.0 - fraction * (1.0 - _RECENCY_FLOOR), 4)


# ---------------------------------------------------------------------------
# Public data structures
# ---------------------------------------------------------------------------

@dataclass
class SourceEvidence:
    """Evidence from one source supporting a field value."""
    source_id: str
    source_type: str
    field_value: str          # Gate-verified accepted value
    fetched_at: Optional[datetime]


@dataclass
class VerifierResult:
    """Full verifier output for one field."""
    # The three sub-scores (stored individually for Phase 8 retuning)
    corroboration_score: float
    authority_score: float
    recency_score: float
    # The composite confidence (ONLY writer of extracted_fields.confidence)
    confidence: float
    # Contradiction detection
    contradiction_flag: bool
    contradiction_note: Optional[str]


# ---------------------------------------------------------------------------
# Corroboration
# ---------------------------------------------------------------------------

def _corroboration_score(evidences: list[SourceEvidence], total_sources: int) -> float:
    """Fraction of distinct sources that support this value.

    'Distinct' = unique source_id. If two sources agree, that's corroboration;
    if only one source has information on this field, score is 1/total.
    Capped at 1.0.
    """
    if total_sources == 0:
        return 0.0
    distinct = len({e.source_id for e in evidences})
    return min(1.0, round(distinct / total_sources, 4))


# ---------------------------------------------------------------------------
# Contradiction detection
# ---------------------------------------------------------------------------

_CONTRADICTION_THRESHOLD = 0.65  # values must be THIS similar to not be contradictions
_CONTRADICTION_CONFIDENCE_CAP = 0.4


def _detect_contradiction(evidences: list[SourceEvidence]) -> tuple[bool, Optional[str]]:
    """Check if multiple gate-verified values disagree with each other.

    Two values are contradictory if their fuzzy-match ratio is below
    _CONTRADICTION_THRESHOLD — i.e., they're clearly saying different things.

    Returns (contradiction_flag, contradiction_note).
    """
    if len(evidences) < 2:
        return False, None

    unique_values = list({e.field_value for e in evidences})
    if len(unique_values) < 2:
        return False, None

    # Check all pairs
    for i, val_a in enumerate(unique_values):
        for val_b in unique_values[i + 1:]:
            similarity = fuzz.ratio(val_a.lower(), val_b.lower()) / 100.0
            if similarity < _CONTRADICTION_THRESHOLD:
                note = f"Conflicting values found: {val_a!r} vs {val_b!r} (similarity={similarity:.2f})"
                log.warning("contradiction_detected", note=note[:200])
                return True, note

    return False, None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_confidence(
    evidences: list[SourceEvidence],
    total_sources: int,
) -> VerifierResult:
    """Compute confidence for one field using the deterministic formula.

    This is the ONLY function that produces values for `extracted_fields.confidence`.

    Args:
        evidences:      List of SourceEvidence objects — one per source that has
                        a gate-verified non-null value for this field.
        total_sources:  Total number of sources fetched for this program
                        (denominator for corroboration score).

    Returns:
        VerifierResult with all three sub-scores, composite confidence,
        and contradiction detection results.

    Formula:
        confidence = 0.5 × corroboration + 0.3 × authority + 0.2 × recency
    """
    if not evidences:
        # No supporting evidence — field is null, confidence is 0
        return VerifierResult(
            corroboration_score=0.0,
            authority_score=0.0,
            recency_score=0.0,
            confidence=0.0,
            contradiction_flag=False,
            contradiction_note=None,
        )

    # Corroboration: fraction of total sources with supporting evidence
    corroboration = _corroboration_score(evidences, total_sources)

    # Authority: weighted average of source type scores
    authority_values = [
        AUTHORITY_WEIGHTS.get(e.source_type.lower(), _DEFAULT_AUTHORITY)
        for e in evidences
    ]
    authority = round(sum(authority_values) / len(authority_values), 4)

    # Recency: score of the most recently fetched supporting source
    recency = max(
        (_recency_score(e.fetched_at) for e in evidences),
        default=_RECENCY_FLOOR,
    )

    # Contradiction detection
    contradiction_flag, contradiction_note = _detect_contradiction(evidences)

    # Composite confidence
    confidence = round(
        0.5 * corroboration + 0.3 * authority + 0.2 * recency,
        4,
    )

    # Cap confidence on contradiction
    if contradiction_flag:
        confidence = min(confidence, _CONTRADICTION_CONFIDENCE_CAP)

    log.info(
        "confidence_computed",
        corroboration=corroboration,
        authority=authority,
        recency=recency,
        confidence=confidence,
        contradiction=contradiction_flag,
        evidence_count=len(evidences),
    )

    return VerifierResult(
        corroboration_score=corroboration,
        authority_score=authority,
        recency_score=recency,
        confidence=confidence,
        contradiction_flag=contradiction_flag,
        contradiction_note=contradiction_note,
    )
