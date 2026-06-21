# InfoVac — Progress & Handoff Log

---

## Handoff — 2026-06-21T13:29:00Z — Phase 4 [BLOCKED: live test failing]

### Status
Unit tests: **28/28 passed** (no API, no DB, no live marker).
Live e2e test (`-m live`): **2 FAILED** — root cause identified, fix in progress.

### What Phase 4 Built
| File | Lines | Role |
|---|---|---|
| `orchestrator/state.py` | 37 | PipelineState TypedDict + iter_fields() |
| `orchestrator/events.py` | 74 | emit_event() + set_status() |
| `orchestrator/nodes.py` | 238 | 4 async nodes: retrieve (tenacity 3×), extract, verify, narrate stub |
| `orchestrator/graph.py` | 58 | Thin wiring + run_pipeline() entry point |
| `backend/models.py` | 120 | Added ExtractedField + PipelineEvent ORM models |
| `backend/db.py` | 40 | Added make_background_session() NullPool ctx manager |
| `backend/main.py` | 161 | POST /run, GET /{id}, GET /{id}/stream (asyncpg LISTEN SSE) |
| `tests/test_orchestrator_unit.py` | 303 | 4 unit tests: event order, retry, iter_fields, short-circuit |
| `tests/test_orchestrator_e2e.py` | 131 | 2 live tests (@pytest.mark.live) |

### Live Test Failure (actual output)
```
tests/test_orchestrator_e2e.py::test_e2e_run_completes  FAILED
tests/test_orchestrator_e2e.py::test_sse_events_in_correct_order  FAILED
2 failed in 191.01s (0:03:11)
```
**Root cause:** `emit_event()` and `set_status()` each created a NEW NullPool engine per call.
During Firecrawl retrieval (20 concurrent threads + ~25 event emissions), repeated engine
creation starved the asyncio event loop, causing GET /api/programs/{id} to timeout at the
test's 30s per-request limit.

**Fix applied to `orchestrator/events.py`:**
- Switched from `make_background_session()` (NullPool, new engine per call) →
  `AsyncSessionLocal()` (shared pool, same event loop as FastAPI — safe because
  `asyncio.create_task()` runs on the same loop, not a separate one)

**Fix still needed:**
- `orchestrator/nodes.py` verify_node: same pool fix for the verify DB writes
- `tests/test_orchestrator_e2e.py`: raise per-request httpx timeout from 30s → 90s
  (retrieval alone takes ~2min per Phase 1 data)
- Re-run `pytest tests/test_orchestrator_e2e.py -m live -v -s` and confirm green

### Next Step (to close Phase 4)
1. Apply pool fix to `nodes.py` verify_node
2. Raise test timeout
3. Kill old uvicorn task, restart uvicorn
4. Run live tests, report real output
5. If green: commit + push + mark Phase 4 complete

---

## Handoff — 2026-06-21T07:57:00Z — Phases 2 + 3 [COMPLETE]

### Phase 2 — Extractor + Gate
Test run: **10/10 gate tests passed in 0.70s**

Built:
- `backend/extractor.py` (343L): 8-category ExtractedSchema, one Instructor call per category,
  content-sanitizer injection defense, `model_certainty_hint` (NOT `confidence`)
- `backend/gate.py` (156L): deterministic rapidfuzz gate, `partial_ratio ≥ 0.80`,
  `GateResult` dataclass, batch verify helper
- `tests/test_gate.py` (199L): 10 tests — null pass, missing-quote reject, exact match,
  hallucination reject (DoD), batch, determinism — no live marker

**CRITICAL design rule (confidence column ownership):**
- `model_certainty_hint` = LLM self-assessment, a hint only. NEVER written to `extracted_fields.confidence`.
- `extracted_fields.confidence` is ONLY written by Phase 3's verifier formula.

### Phase 3 — Verifier
Test run: **14/14 verifier tests passed in 0.70s**

Built:
- `backend/verifier.py` (252L): `confidence = 0.5×corroboration + 0.3×authority + 0.2×recency`,
  contradiction detection + cap at 0.4, ONLY writer of `extracted_fields.confidence`
- `tests/test_verifier.py` (255L): 14 tests — hand-calculated formula, mixed authority,
  stale recency, contradiction cap (DoD), 10-run determinism (DoD) — no live marker

Authority weights: `tnc=1.0, press=0.9, faq=0.8, news=0.7, app_review=0.6, forum=0.5`
Recency: linear decay 1.0 (≤30 days) → 0.3 (≥365 days), floor 0.3

### Decisions closed this session
- **OPEN_DECISIONS.md #1** (robots.txt): Option D — allow + mark `fetch_status='robots_unverified'`
- **OPEN_DECISIONS.md #2** (test mocking): Option B — `@pytest.mark.live` marker
  - Default `pytest` = fast, no API calls, <5s
  - Phase-gate: `pytest -m live -v -s`

---

## Handoff — 2026-06-21T02:19:00+05:30 — Phase 1 [COMPLETE]

### Test run (actual output)
```
pytest tests/test_retriever.py -m live -v -s → 4 passed in 368.69s (0:06:08)
```

### Built and verified
- `backend/models.py`: Source ORM model
- `backend/retriever.py`: discover_sources() — Tavily (6 types × 5 results), dedup,
  robots.txt check (3-value: allowed/blocked/robots_unverified), Firecrawl fetch,
  Tavily-snippet fallback, DB insert
- `tests/conftest.py`: NullPool engine per test — definitive fix for asyncpg cross-loop
  crash on Windows Python 3.14
- `tests/test_retriever.py`: 4 DoD tests (@pytest.mark.live)
- `scripts/run_retriever.py`: manual spot-check table printer

### Real results verified
```
Starbucks Rewards : types={faq, tnc, app_review, press, news, forum}
Marriott Bonvoy   : 21 sources, types={press, faq, tnc, app_review, news}
Delta SkyMiles    : 21 sources, types={forum, press, faq, tnc, app_review, news}
Fake program      : 0 sources, no crash
Reddit/Facebook   : correctly robots_blocked
```

### Decisions
- Tavily: 1 query/type × 6 types × 5 results = 30 candidates → dedup → ~15 unique
- Firecrawl: full markdown fetch; Tavily snippet fallback guarantees raw_content never empty
- robots.txt: 3-value return (allowed/blocked/robots_unverified) — Decision #1-D
- Source-type: query-of-origin primary, URL pattern override secondary

---

## Handoff — 2026-06-20T20:56:00+05:30 — Phase 0 [COMPLETE]

### Test run (actual output)
```
pytest tests/phase0_test.py -v
5 passed in 8.38s
```

### Built and verified
- `docker-compose.yml`: Postgres 15-alpine, healthcheck, persistent volume
- `alembic/versions/0001_initial_schema.py`: 9 tables, LISTEN/NOTIFY trigger, 5 indexes
- `backend/main.py`: FastAPI POST /api/programs → UUID insert
- `backend/db.py`: async SQLAlchemy + asyncpg session
- `backend/models.py`: Program ORM model
- `orchestrator/graph.py`: LangGraph 4-node stub
- `scripts/instructor_smoke.py`: Instructor+Gemini-2.5-flash one-field extraction
- `tests/phase0_test.py`: 5 DoD checks

### Decisions
- `google-generativeai` (old SDK) kept for instructor compat — `instructor.from_gemini()`
  requires `genai.GenerativeModel`. FutureWarning suppressed in pytest.ini.
- `Mode.MD_JSON` replaces deprecated `Mode.GEMINI_JSON` (instructor ≥ 1.15)
- 9 tables (not 7) — eval_ground_truth + redteam_tests per SOLUTION.md Day 8-9 plan
- No Redis — Postgres LISTEN/NOTIFY replaces it entirely
- NullPool in test conftest — only reliable fix for Windows Python 3.14 asyncpg

---

## Do Not Reconsider (accumulated invariants)
- No Redis anywhere — Postgres LISTEN/NOTIFY handles all pub/sub
- NullPool in `tests/conftest.py` — do not revert
- One Instructor call per category (not one monolithic call)
- `model_certainty_hint` ≠ `confidence` — only verifier.py writes `extracted_fields.confidence`
- `google-generativeai` SDK kept for instructor compat — FutureWarning suppressed, not fixed
- `asyncio.create_task()` in FastAPI + same event loop → use `AsyncSessionLocal` for emit/status
  (NullPool only for test fixtures and thread-executor callers)
- All files must stay ≤ 500 lines — split into modules if approaching limit
- Default `pytest` = fast (no live marker) — always runs clean in <10s
- Phase-gate certification = `pytest -m live`

---

## Pending Phases

### Phase 5 — Narrator (next after Phase 4 live tests green)
- `backend/narrator.py`: generate_narrative(program_id) → 500-1000 word brief
- Use Gemini-2.5-flash, word count enforced in code (not LLM-trusted)
- Input: gate-verified extracted_fields rows only
- Output: stored in `narratives` table
- DoD: `pytest tests/test_narrator.py` — word count within bounds, no hallucination beyond
  extracted_fields data

### Phase 6 — Comparator
- `backend/comparator.py`: compare two programs by UUID
- Input: extracted_fields rows for both programs
- Output: strategic diff stored in `comparisons` table

### Phase 7 — Chat (grounded Q&A)
- Grounded-only follow-up Q&A (no outside knowledge)
- Input re-injected from extracted_fields + narratives every turn

### Phase 8 — Eval harness + threshold calibration
- Hand-verify 8-10 programs → populate eval_ground_truth
- Calibrate gate threshold (currently 0.80, untuned placeholder)
- Calibrate confidence null-threshold against rubric math (+1/+0.5/0/-3)

### Phase 9 — Red-team + injection tests
- Indirect prompt injection: scraped content containing instructions
- Low web-presence programs: graceful null, no padding
- Recently-rebranded programs: contradiction detection verification
