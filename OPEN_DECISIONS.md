# OPEN_DECISIONS.md

Decisions that require explicit human input before implementation continues.
Status: ✅ CLOSED or ⏳ OPEN.

---

## #1 — Robots.txt: what to do when the check fails or is ambiguous

**Status: ✅ CLOSED — Decision: D (Allow + mark `fetch_status='robots_unverified'`)**

**Decision rationale (user, 2026-06-21):**
> Fail-closed (B) risks killing legitimate sources on a transient timeout. Fail-open silently
> (A) hides the ambiguity, which is inconsistent with everything else in this system — you
> don't silently resolve uncertainty anywhere else, don't start here. D is the only option
> that's honest about what happened.
> Caveat: hackathon-scope answer — revisit before any real Kobie production use,
> per the legal-review flag already in SOLUTION.md.

**Implementation (done in `backend/retriever.py`):**
- `_check_robots()` now returns `'allowed' | 'blocked' | 'robots_unverified'` (not bool)
- `'blocked'` → URL is skipped entirely, logged as `robots_blocked`
- `'robots_unverified'` → URL is fetched AND `fetch_status='robots_unverified'` stored in DB
- Gate/eval layer can filter on `fetch_status='robots_unverified'` if needed

---

## #2 — Test suite: live API calls vs mocked for routine runs

**Status: ✅ CLOSED — Decision: B (`@pytest.mark.live` marker)**

**Decision rationale (user, 2026-06-21):**
> `@pytest.mark.live`, with one refinement: gate/formula logic tests (fuzzy-match math,
> confidence weights) are pure functions and should run unmocked-but-API-free by construction,
> no flag needed either way. Reserve `@pytest.mark.live` only for tests that actually hit
> Tavily/Firecrawl/Gemini. Default pytest run = fast logic tests.
> Phase-gate certification = explicit `pytest -m live`.

**Implementation (done):**
- `pytest.ini`: registered `live` marker with `--strict-markers` (typo-markers error, not silently pass)
- `tests/test_retriever.py`: `pytestmark = pytest.mark.live` at module level
- Phase 0 tests (`tests/phase0_test.py`): NOT marked live — they use asyncpg/httpx directly,
  no Tavily/Firecrawl/Gemini (smoke test is the only Gemini call, acceptable)
- Phase 2 extractor tests (`tests/test_extractor.py`): gate/formula tests = no marker;
  tests that hit Gemini for extraction = `@pytest.mark.live`
- Phase 2 gate tests (`tests/test_gate.py`): pure fuzzy-match math = no marker, always runs

**Workflow:**
```bash
pytest                    # fast: logic + phase0 (seconds)
pytest -m live            # full phase-gate certification (minutes, burns API quota)
pytest -m live -v -s      # phase-gate with verbose output for human review
```

---

*Last updated: 2026-06-21 — Both decisions closed before Phase 2 starts.*
