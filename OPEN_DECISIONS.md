# InfoVac — Open Decisions Log

All decisions that required explicit human input, with rationale and implementation notes.
Both decisions are now **CLOSED**.

---

## #1 — Robots.txt: what to do when the check fails or is ambiguous

**Status: ✅ CLOSED — Decision: D**

**Decision:** Allow scraping but mark `fetch_status='robots_unverified'` in DB.

**User rationale:**
> Fail-closed risks killing legitimate sources on a transient timeout.
> Fail-open silently hides the ambiguity — inconsistent with everything else in this system.
> D is the only option that's honest about what happened.
> Caveat: hackathon-scope — revisit before any real Kobie production use per SOLUTION.md legal flag.

**Implementation (`backend/retriever.py`):**
- `_check_robots()` returns `'allowed' | 'blocked' | 'robots_unverified'` (not bool)
- `'blocked'` → URL skipped, logged as `robots_blocked`
- `'robots_unverified'` → URL is fetched AND stored with `fetch_status='robots_unverified'`
- Gate/eval layer can filter on `fetch_status='robots_unverified'` if needed downstream

---

## #2 — Test suite: live API calls vs mocked for routine runs

**Status: ✅ CLOSED — Decision: B**

**Decision:** `@pytest.mark.live` marker gates all tests that hit external APIs.

**User rationale:**
> `@pytest.mark.live` with refinement: gate/formula logic tests (fuzzy-match math,
> confidence weights) are pure functions — no flag needed. Reserve `@pytest.mark.live`
> only for tests that actually hit Tavily/Firecrawl/Gemini.
> Default pytest run = fast logic tests. Phase-gate certification = `pytest -m live`.

**Implementation:**
- `pytest.ini`: registered `live` marker + `--strict-markers` (typo-markers error, not silently pass)
- `pytest.ini`: `filterwarnings` suppresses third-party google/firecrawl noise
- `tests/test_retriever.py`: `pytestmark = pytest.mark.live` at module level
- `tests/test_orchestrator_e2e.py`: `pytestmark = pytest.mark.live` at module level
- Phase 2 gate tests, Phase 3 verifier tests: NO marker — always run
- Phase 4 orchestrator unit tests: NO marker — always run

**Workflow:**
```bash
pytest                         # fast: gate + verifier + orchestrator unit (< 10s)
pytest -m live -v -s           # full phase-gate certification (minutes, burns API quota)
pytest tests/test_retriever.py -m live -v -s   # Phase 1 only
pytest tests/test_orchestrator_e2e.py -m live -v -s  # Phase 4 e2e only
```

---

*Last updated: 2026-06-21 — Both decisions closed. No open decisions remaining.*
