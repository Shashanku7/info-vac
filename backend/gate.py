"""Citation-Verification Gate — Phase 2.

Every non-null field extracted by the Extractor must pass this gate before
being written to the DB or trusted downstream.

Gate logic:
  - Fuzzy-match the `evidence_quote` against the source's `raw_content`
  - Threshold: rapidfuzz partial_ratio >= 0.80 (untuned placeholder — retune at Phase 8)
  - On failure: field value is rejected to null, event logged to pipeline_events

The gate is deterministic code, not an LLM call. This is deliberate: it is
the check on non-deterministic upstream stages, and must itself be trustworthy.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import structlog
from rapidfuzz import fuzz

log = structlog.get_logger(__name__)

# Gate threshold — untuned placeholder.
# Retune against eval_ground_truth on Phase 8 (Day 8 per infovac_solution.md).
# Set deliberately conservative: better to reject ambiguous matches than pass hallucinations.
GATE_THRESHOLD = 0.80


@dataclass
class GateResult:
    """Result of a single gate verification."""
    passed: bool
    match_score: float          # 0.0–1.0 — raw rapidfuzz score
    matched_value: Optional[str]  # The accepted value (None if rejected)
    rejection_reason: Optional[str]  # Human-readable reason for rejection


def gate_verify(
    field_name: str,
    claimed_value: Optional[str],
    evidence_quote: Optional[str],
    source_raw_content: str,
    threshold: float = GATE_THRESHOLD,
) -> GateResult:
    """Verify that `evidence_quote` is textually present in `source_raw_content`.

    Args:
        field_name:          Name of the field being verified (for logging)
        claimed_value:       The value the Extractor claims (may be None)
        evidence_quote:      Verbatim quote the Extractor cites as support
        source_raw_content:  Full raw_content of the source page
        threshold:           Minimum fuzzy-match ratio to pass (default 0.80)

    Returns:
        GateResult with `passed=True` and `matched_value=claimed_value` on success,
        or `passed=False` and `matched_value=None` on rejection.

    Gate rejection conditions:
      1. claimed_value is None → always passes (null is an honest answer, not a claim)
      2. evidence_quote is None → rejected (non-null claim with no citation)
      3. evidence_quote not found in raw_content above threshold → rejected
    """
    # Null values are always honest — gate passes trivially
    if claimed_value is None:
        return GateResult(
            passed=True,
            match_score=1.0,
            matched_value=None,
            rejection_reason=None,
        )

    # Non-null claim but no citation → reject
    if not evidence_quote or not evidence_quote.strip():
        log.warning(
            "gate_reject_no_quote",
            field=field_name,
            claimed_value=claimed_value[:100] if claimed_value else None,
        )
        return GateResult(
            passed=False,
            match_score=0.0,
            matched_value=None,
            rejection_reason="non-null value has no evidence_quote",
        )

    if not source_raw_content:
        log.warning("gate_reject_empty_source", field=field_name)
        return GateResult(
            passed=False,
            match_score=0.0,
            matched_value=None,
            rejection_reason="source raw_content is empty",
        )

    # Fuzzy match: partial_ratio finds the best matching substring of source_raw_content
    # for the evidence_quote, so partial quotes still score well.
    raw_score = fuzz.partial_ratio(evidence_quote.lower(), source_raw_content.lower())
    score = raw_score / 100.0  # normalize to 0.0–1.0

    if score >= threshold:
        log.info(
            "gate_pass",
            field=field_name,
            score=round(score, 3),
            threshold=threshold,
        )
        return GateResult(
            passed=True,
            match_score=score,
            matched_value=claimed_value,
            rejection_reason=None,
        )
    else:
        log.warning(
            "gate_reject_low_score",
            field=field_name,
            score=round(score, 3),
            threshold=threshold,
            evidence_quote_preview=evidence_quote[:80] if evidence_quote else None,
        )
        return GateResult(
            passed=False,
            match_score=score,
            matched_value=None,
            rejection_reason=f"fuzzy match score {score:.3f} below threshold {threshold}",
        )


def gate_verify_batch(
    field_extractions: dict[str, tuple[Optional[str], Optional[str]]],
    source_raw_content: str,
    threshold: float = GATE_THRESHOLD,
) -> dict[str, GateResult]:
    """Verify multiple fields against one source in a single call.

    Args:
        field_extractions: {field_name: (claimed_value, evidence_quote)}
        source_raw_content: The source page content to verify against
        threshold: Minimum match ratio

    Returns:
        {field_name: GateResult}
    """
    return {
        field_name: gate_verify(
            field_name=field_name,
            claimed_value=claimed_value,
            evidence_quote=evidence_quote,
            source_raw_content=source_raw_content,
            threshold=threshold,
        )
        for field_name, (claimed_value, evidence_quote) in field_extractions.items()
    }
