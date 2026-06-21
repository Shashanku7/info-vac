"""Phase 1 Retriever — Definition of Done tests.

Prerequisites:
  1. docker compose up -d   (Postgres running, schema migrated)
  2. .env with TAVILY_API_KEY and FIRECRAWL_API_KEY set

Markers:
  All tests here are @pytest.mark.live — they make real Tavily+Firecrawl calls.
  Decision #2 (OPEN_DECISIONS.md): default 'pytest' run skips live tests;
  phase-gate certification uses 'pytest -m live'.

  Run for certification:
      pytest tests/test_retriever.py -m live -v -s

  Run fast logic-only (default, no API calls):
      pytest  (live tests automatically skipped)

Human checkpoint:
  After a live run, open 2-3 of the printed URLs in a browser.
  Are they actually pages about that loyalty program, or tangentially related?
"""
import pytest

from backend.models import Source
from backend.retriever import discover_sources
from sqlalchemy import select

# All tests in this file require live API calls
pytestmark = pytest.mark.live


# ---------------------------------------------------------------------------
# Test 1: Known program → ≥10 sources, ≥3 distinct source_types, all with content
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_known_program_returns_rich_sources(temp_program, db_session):
    """DoD: Run on one known program → ≥10 sources, ≥3 distinct source_type values."""
    sources = await discover_sources(
        program_name="Starbucks Rewards",
        program_id=temp_program.id,
        db=db_session,
    )

    # --- Quantity ---
    assert len(sources) >= 10, (
        f"Expected ≥10 sources, got {len(sources)}. "
        f"Types: {[s.source_type for s in sources]}"
    )

    # --- Source-type diversity (the anti-homepage-only check) ---
    distinct_types = {s.source_type for s in sources}
    assert len(distinct_types) >= 3, (
        f"Expected ≥3 distinct source_types, got {distinct_types}"
    )

    # --- Every stored source has non-empty raw_content ---
    for s in sources:
        assert s.raw_content and len(s.raw_content.strip()) > 0, (
            f"Source {s.url} has empty raw_content"
        )

    print(f"\n[PASS] {len(sources)} sources stored, types: {distinct_types}")
    print("Sample URLs (open these in a browser for human spot-check):")
    for s in sorted(sources, key=lambda x: x.source_type)[:8]:
        print(f"  [{s.source_type:<12}] {s.url}")


# ---------------------------------------------------------------------------
# Test 2: Fake program → returns gracefully, no exception
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fake_program_graceful_empty(temp_program, db_session):
    """DoD: Run on a deliberately fake/unknown program → returns gracefully, no crash."""
    sources = await discover_sources(
        program_name="ZXQ Quantum Loyalty Program 99999 NONEXISTENT",
        program_id=temp_program.id,
        db=db_session,
    )

    # Must return a list — possibly empty, that's correct behaviour
    assert isinstance(sources, list), f"Expected list, got {type(sources)}"

    # If anything came back, it still must have raw_content
    for s in sources:
        assert s.raw_content and len(s.raw_content.strip()) > 0

    print(f"\n[PASS] Fake program returned {len(sources)} sources (no crash).")


# ---------------------------------------------------------------------------
# Test 3: content_hash is set on every stored source
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_content_hash_populated(temp_program, db_session):
    """Every stored source must have a SHA-256 content_hash."""
    sources = await discover_sources(
        program_name="Marriott Bonvoy",
        program_id=temp_program.id,
        db=db_session,
    )

    if not sources:
        pytest.skip("No sources returned — check API keys.")

    for s in sources:
        assert s.content_hash and len(s.content_hash) == 64, (
            f"Source {s.url} has invalid content_hash: {s.content_hash!r}"
        )

    print(f"\n[PASS] All {len(sources)} sources have valid SHA-256 content_hash.")


# ---------------------------------------------------------------------------
# Test 4: fetch_method is recorded on every source
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fetch_method_recorded(temp_program, db_session):
    """fetch_method must be 'firecrawl' or 'tavily_snippet' — never null or unknown."""
    sources = await discover_sources(
        program_name="Delta SkyMiles",
        program_id=temp_program.id,
        db=db_session,
    )

    if not sources:
        pytest.skip("No sources returned — check API keys.")

    valid_methods = {"firecrawl", "tavily_snippet"}
    for s in sources:
        assert s.fetch_method in valid_methods, (
            f"Source {s.url} has unexpected fetch_method: {s.fetch_method!r}"
        )

    fc = sum(1 for s in sources if s.fetch_method == "firecrawl")
    sn = sum(1 for s in sources if s.fetch_method == "tavily_snippet")
    print(f"\n[PASS] fetch_method: firecrawl={fc}, snippet={sn}")
