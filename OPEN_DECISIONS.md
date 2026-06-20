# OPEN_DECISIONS.md

Decisions that require explicit human input before implementation continues.
Each entry states: what was done, why it's not settled, and the concrete options.

---

## #1 — Robots.txt: what to do when the check fails or is ambiguous

**Current behaviour (Phase 1, `backend/retriever.py` line ~110):**
```python
except Exception:
    pass
return True  # allow on error
```
If `/robots.txt` returns a non-200, times out, or fails to parse, the URL is treated as **allowed** and Firecrawl will scrape it.

**Why this deserves an explicit decision:**
The whole robots.txt check exists for compliance — it's not a nice-to-have.
"Allow on error" is the opposite of a fail-safe default: a site might be unreachable
precisely because it's blocking scrapers. Silently proceeding undermines the feature's
stated purpose. The agent made this call alone without flagging it.

**Options:**

| Option | Behaviour on error/ambiguity | Trade-off |
|--------|------------------------------|-----------|
| **A — Allow (current)** | Scrape anyway | Maximum recall; weak compliance story |
| **B — Deny** | Skip the URL; log `fetch_status='robots_unknown'` | Safe default; may reduce recall on flaky sites |
| **C — Deny + retry once** | Wait 2s, retry the robots fetch; deny if still fails | Best of both; one extra network call per URL |
| **D — Allow, but mark** | Scrape but set `fetch_status='robots_unverified'` | Transparent; lets humans filter later |

**Recommendation (agent's view):** Option D for Phase 2. It preserves recall,
makes the uncertainty explicit in the DB, and lets the gate/eval layer decide
whether to trust unverified sources. Pure denial (B) would hurt extraction quality
for programs whose sites happen to have flaky robots.txt serving.

**To close this:** Pick A/B/C/D (or describe a variant). The implementation change
is 3 lines in `_check_robots()`.

---

## #2 — Test suite: live API calls vs mocked for routine runs

**Current behaviour (`tests/test_retriever.py`):**
All 4 tests make real Tavily + Firecrawl calls. Runtime: ~6 minutes per run.
Tavily free tier: ~1,000 req/day. Firecrawl free tier: limited credits (not unlimited).
4 tests × 4 programs × 6 Tavily queries + up to 20 Firecrawl calls each = significant quota burn per run.

**Why this matters:**
The Phase 1 tests are the phase-gate verification, run once at handoff. But if
they also run in normal dev (e.g., `pytest` with no filter), credits burn fast and
tests are fragile on flaky external APIs.

**Options:**

| Option | How | When live calls run |
|--------|-----|---------------------|
| **A — Keep as-is** | No change | Every `pytest` run |
| **B — `@pytest.mark.live` gate** | Mark tests needing real APIs; run with `pytest -m live` | Only when explicitly requested |
| **C — Mock by default, live with flag** | `conftest` fixture uses `respx`/`unittest.mock` to mock Tavily+Firecrawl; `--live` flag disables mock | Default: fast, free; phase-gate: real |
| **D — Separate test files** | `tests/test_retriever_mock.py` (always runs) + `tests/test_retriever_live.py` (phase-gate only) | Explicit by filename |

**Recommendation (agent's view):** Option B is the fastest to implement (one decorator
+ `pytest.ini` `markers` entry). Option C gives the best long-term value but adds mock
maintenance. For a hackathon timeline, B is the right trade-off.

**To close this:** Pick an option. If B or C, the agent will implement mocks and
add the `live` marker to existing tests before Phase 2 test suite is written.

---

*Last updated: 2026-06-21 — Phase 1 complete, Phase 2 not yet started.*
