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
    # Normalize empty or whitespace strings to None (Problem 4)
    if claimed_value is not None and not claimed_value.strip():
        claimed_value = None

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

    # Segment-based fuzzy verification for composite/stitched quotes (Problem 2)
    # Split by standard ellipsis patterns and newlines
    quote_clean = evidence_quote.replace("...", "\n").replace("â€¦", "\n").replace("...", "\n")
    segments = [s.strip() for s in quote_clean.split("\n") if s.strip()]

    if not segments:
        return GateResult(
            passed=False,
            match_score=0.0,
            matched_value=None,
            rejection_reason="evidence_quote contains no text segments",
        )

    scores = []
    for seg in segments:
        if len(seg) < 8:  # skip tiny filler words to prevent false positives
            continue
        raw_score = fuzz.partial_ratio(seg.lower(), source_raw_content.lower())
        scores.append(raw_score / 100.0)

    if not scores:
        # Fallback to checking the whole quote if all segments were too short
        raw_score = fuzz.partial_ratio(evidence_quote.lower(), source_raw_content.lower())
        score = raw_score / 100.0
    else:
        # The overall match score is the minimum score of all segments (weakest-link principle) (Problem 2)
        score = min(scores)

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


def find_best_source_for_quote(
    evidence_quote: str,
    url_to_source: dict[str, dict],
    threshold: float = GATE_THRESHOLD,
) -> tuple[Optional[str], Optional[str]]:
    """Scan ALL fetched sources to find where evidence_quote best matches.

    Called by verify_node when the LLM claims a source_url that either
    doesn't exist in our DB or whose content doesn't pass the gate. This
    function tries every source, picks the one with the highest partial_ratio,
    and returns it if it clears the threshold.

    Args:
        evidence_quote:  The verbatim quote the LLM extracted.
        url_to_source:   {url: source_dict} mapping for this program.
        threshold:       Minimum fuzzy-match ratio to accept (default 0.80).

    Returns:
        (best_url, best_source_id) if any source clears threshold, else (None, None).
    """
    if not evidence_quote or not url_to_source:
        return None, None

    quote_lower = evidence_quote.lower()
    best_score = 0.0
    best_url: Optional[str] = None
    best_id: Optional[str] = None

    quote_clean = evidence_quote.replace("...", "\n").replace("â€¦", "\n").replace("...", "\n")
    segments = [s.strip() for s in quote_clean.split("\n") if s.strip()]

    for url, src_dict in url_to_source.items():
        content = src_dict.get("raw_content", "")
        if not content:
            continue

        if not segments:
            raw_score = fuzz.partial_ratio(quote_lower, content.lower())
            score = raw_score / 100.0
        else:
            seg_scores = []
            for seg in segments:
                if len(seg) < 8:
                    continue
                raw_score = fuzz.partial_ratio(seg.lower(), content.lower())
                seg_scores.append(raw_score / 100.0)
            score = sum(seg_scores) / len(seg_scores) if seg_scores else 0.0

        if score > best_score:
            best_score = score
            best_url = url
            best_id = src_dict.get("id")

    if best_score >= threshold:
        log.info(
            "multi_source_match_found",
            best_url=best_url,
            score=round(best_score, 3),
        )
        return best_url, best_id

    log.debug(
        "multi_source_no_match",
        best_score=round(best_score, 3),
        threshold=threshold,
    )
    return None, None


def gate_verify_multi_source(
    field_name: str,
    claimed_value: Optional[str],
    evidence_quote: Optional[str],
    url_to_source: dict[str, dict],
    threshold: float = GATE_THRESHOLD,
) -> tuple[GateResult, Optional[str], Optional[str]]:
    """Verify each segment of evidence_quote against ALL available sources.
    
    Returns:
        (GateResult, matched_url, matched_source_id)
    """
    # Normalize empty or whitespace strings to None (Problem 4)
    if claimed_value is not None and not claimed_value.strip():
        claimed_value = None

    if claimed_value is None:
        return GateResult(
            passed=True,
            match_score=1.0,
            matched_value=None,
            rejection_reason=None,
        ), None, None

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
        ), None, None

    # Segment-based fuzzy verification for composite/stitched quotes (Problem 2)
    # Split by standard ellipsis patterns and newlines
    quote_clean = evidence_quote.replace("...", "\n").replace("â€¦", "\n").replace("...", "\n")
    segments = [s.strip() for s in quote_clean.split("\n") if s.strip()]

    if not segments:
        return GateResult(
            passed=False,
            match_score=0.0,
            matched_value=None,
            rejection_reason="evidence_quote contains no text segments",
        ), None, None

    # Track matches for each segment
    segment_scores = []
    segment_sources = []

    for seg in segments:
        if len(seg) < 8:  # skip tiny filler words to prevent false positives
            continue
        
        # Find the best matching source for this segment
        best_seg_score = 0.0
        best_seg_url = None
        best_seg_id = None

        for url, src_dict in url_to_source.items():
            content = src_dict.get("raw_content", "")
            if not content:
                continue
            raw_score = fuzz.partial_ratio(seg.lower(), content.lower())
            score = raw_score / 100.0
            if score > best_seg_score:
                best_seg_score = score
                best_seg_url = url
                best_seg_id = src_dict.get("id")

        segment_scores.append(best_seg_score)
        if best_seg_url:
            segment_sources.append((best_seg_url, best_seg_id))

    if not segment_scores:
        # Fallback if all segments were too short
        best_url, best_id = None, None
        best_score = 0.0
        for url, src_dict in url_to_source.items():
            content = src_dict.get("raw_content", "")
            if not content:
                continue
            raw_score = fuzz.partial_ratio(evidence_quote.lower(), content.lower())
            score = raw_score / 100.0
            if score > best_score:
                best_score = score
                best_url = url
                best_id = src_dict.get("id")
        
        passed = best_score >= threshold
        return GateResult(
            passed=passed,
            match_score=best_score,
            matched_value=claimed_value if passed else None,
            rejection_reason=None if passed else f"fuzzy match score {best_score:.3f} below threshold {threshold}",
        ), best_url, best_id

    # Weakest-link principle (Problem 2): min() instead of average()
    min_score = min(segment_scores)
    passed = min_score >= threshold

    if passed:
        # Attributing using majority vote: the source that matched the most segments (Thing 1)
        primary_url, primary_id = None, None
        if segment_sources:
            from collections import Counter
            counts = Counter(segment_sources)
            (primary_url, primary_id), _ = counts.most_common(1)[0]
        log.info(
            "gate_multi_source_pass",
            field=field_name,
            score=round(min_score, 3),
            threshold=threshold,
        )
        return GateResult(
            passed=True,
            match_score=min_score,
            matched_value=claimed_value,
            rejection_reason=None,
        ), primary_url, primary_id
    else:
        log.warning(
            "gate_multi_source_reject_low_score",
            field=field_name,
            score=round(min_score, 3),
            threshold=threshold,
            evidence_quote_preview=evidence_quote[:80] if evidence_quote else None,
        )
        return GateResult(
            passed=False,
            match_score=min_score,
            matched_value=None,
            rejection_reason=f"fuzzy match score {min_score:.3f} below threshold {threshold}",
        ), None, None

