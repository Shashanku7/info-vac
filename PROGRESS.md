## Handoff — 2026-06-21T02:19:00+05:30 — Phase 1 [complete]

### Built and verified this session
- `backend/models.py`: Added `Source` ORM model (all columns, relationship to Program, SHA-256 hash helper)
- `backend/retriever.py`: `discover_sources()` — Tavily (6 types × 5 results), dedup, robots.txt check, Firecrawl fetch, Tavily-snippet fallback, DB insert
- `tests/conftest.py`: NullPool engine per test — the definitive fix for asyncpg cross-loop crash on Windows Python 3.14
- `tests/test_retriever.py`: 4 DoD tests
- `scripts/run_retriever.py`: Manual spot-check table printer

Test run: `pytest tests/test_retriever.py -v -s` → **4 passed in 368.69s (0:06:08)**

Real results from test logs:
```
Starbucks Rewards : types={faq, tnc, app_review, press, news, forum}
Marriott Bonvoy   : 21 sources, types={press, faq, tnc, app_review, news}
Delta SkyMiles    : 21 sources, types={forum, press, faq, tnc, app_review, news}
Fake program      : 0 sources returned, no crash
Reddit URLs       : correctly robots_blocked
Facebook URLs     : correctly robots_blocked
```

Sample stored URLs (human spot-check):
- `[faq       ] https://www.delta.com/us/en/skymiles/overview`  (81K chars Firecrawl)
- `[tnc       ] https://skymilesforbusiness.delta.com/s/terms-and-conditions`  (43K chars)
- `[app_review] https://apps.apple.com/us/app/fly-delta/id388491656`  (11K chars)
- `[press     ] https://apnews.com/article/delta-skymiles-change-frequent-flyers-...`
- `[news      ] https://news.delta.com/tags/skymiles`


### Decisions made and why
- Tavily: 1 query per source_type × 6 types × max 5 results = 30 candidates → deduplicate to ~15 unique URLs
- Firecrawl: scrape each allowed URL; fall back to Tavily snippet if Firecrawl fails — guarantees raw_content is never empty for stored rows
- Robots.txt: async httpx GET /robots.txt + urllib.robotparser before every Firecrawl call; **allow on error** — see OPEN_DECISIONS.md #1, this is a policy choice not a technical default
- Source-type classification: query-of-origin is the primary signal; URL pattern matching is a secondary override (app store URLs → app_review regardless of which query found them)
- Fake program test: assert list returned (possibly empty), assert no exception — Tavily may still return tangentially related results for any query

### Exact next step — Phase 2: Extractor + Content Sanitizer + Citation-Verification Gate

**Goal:** Run on Delta SkyMiles' already-fetched sources (in DB from Phase 1) and produce
a fully schema-valid 43-field output where every non-null field is gate-verified.

**File 1 — `backend/extractor.py`**
- Function: `extract_fields(sources: list[Source], program: Program) -> ExtractedSchema`
- Use `Instructor + Gemini-2.5-flash` with `Mode.MD_JSON`
- Split the 43 fields into the **8 categories from the problem statement** (infovac_ps.md line 54-62):
  1. **Program Basics** — name, brand, industry, type, geography, membership count
  2. **Partnerships** — partner names, partnership type (earn/burn/both), details
  3. **Earn Mechanics** — base earn rate, bonus categories, non-transactional earn
  4. **Digital Experience** — mobile app, app ratings, personalization, gamification
  5. **Burn Mechanics** — redemption options, thresholds, point value, expiry policy
  6. **Member Sentiment** — ratings, common praise, common complaints, sources checked
  7. **Tier System** — tier names, qualification criteria, benefits, qualification period
  8. **Competitive Position** — key differentiators, weaknesses, closest competitors
- One Instructor call per category, not one monolithic call —
  avoids context overflow and makes partial failures recoverable.
- Pass source content as **tool-result data** (inside the messages array as
  `role: tool` blocks), not as instruction text in the system prompt. This is the
  grounding pattern: model cannot confabulate beyond what's in the tool results.
- `ExtractedSchema`: Pydantic model with all 43 fields nullable + `model_certainty_hint: float | None` +
  `evidence_quote: str | None` per field. Store as rows in `extracted_fields` table.
- **CRITICAL — confidence column ownership:** `model_certainty_hint` is the LLM's
  self-reported certainty (a low-weight tiebreaker signal at most). It NEVER writes
  to `extracted_fields.confidence`. That column is populated ONLY by Phase 3's
  deterministic formula: `0.5×corroboration + 0.3×authority + 0.2×recency`.
  If Phase 3 is skipped or delayed, `extracted_fields.confidence` must stay NULL —
  not be backfilled with the model's self-assessment.

**File 2 — `backend/gate.py`**
- Function: `gate_verify(field_name, claimed_value, evidence_quote, source_raw_content) -> bool`
- Fuzzy-match `evidence_quote` against `source_raw_content` using `rapidfuzz` (ratio ≥ 0.80)
- If no match: reject the field value to `null`, log to `pipeline_events` with
  `event_type='gate_reject'`
- Every non-null field in the final output must have passed the gate. No exceptions.

**Entry point:** `POST /api/programs/{id}/extract` — loads sources from DB, calls
`extract_fields`, runs gate on each non-null field, writes results to `extracted_fields`.

**DoD for Phase 2:**
- `pytest tests/test_extractor.py` green
- Delta SkyMiles run produces ≥30/43 fields non-null
- Zero non-null fields without a passing gate score
- Gate correctly rejects an injected hallucinated value in `tests/test_gate.py`

### Do not reconsider
- (see Phase 0 entry below)
- `google-generativeai` SDK: still needed for instructor compat — do NOT migrate mid-phase
- NullPool in conftest — do not revert, it's the only reliable fix for Windows Python 3.14
- One Instructor call per category (not one monolithic) — settled above, don't collapse

### Open / blocked
- None — OPEN_DECISIONS.md #1 (robots.txt) and #2 (test mocking) both closed.

---

### Exact next step — Phase 3: Verifier (deterministic confidence + contradiction detection)

**Goal:** Confidence and contradiction logic is correct and deterministic.
Phase 3 builds no new LLM calls — it's pure computation over the gate-verified output
from Phase 2.

**File — `backend/verifier.py`**
- Function: `compute_confidence(field_name, extracted_fields: list[ExtractedField], sources: list[Source]) -> float`
  - `corroboration` = count of distinct sources supporting this field value / total sources (capped at 1.0)
  - `authority` = weighted average of source_type tier scores:
    - `tnc` = 1.0, `press` = 0.9, `faq` = 0.8, `news` = 0.7, `app_review` = 0.6, `forum` = 0.5
  - `recency` = sigmoid decay: sources fetched within 30 days = 1.0; >365 days = 0.3
  - Formula: `confidence = 0.5×corroboration + 0.3×authority + 0.2×recency`
  - Writes result to `extracted_fields.confidence` — the ONLY writer of this column
- Function: `detect_contradictions(field_name, extracted_fields: list[ExtractedField]) -> bool`
  - Two or more gate-verified values for the same field that don't fuzzy-match each other
  - Sets `extracted_fields.contradiction_flag = True`, caps confidence at 0.4

**DoD for Phase 3 (`pytest tests/test_verifier.py`):**
- Fixture inputs with known corroboration/authority/recency → formula output matches hand-calculated expected value exactly
- Two sources with conflicting values → `contradiction_flag = True`, confidence ≤ 0.4
- Run formula twice on identical input → byte-identical output (determinism regression test)

**Human checkpoint:** None — pure formula, agent-verifiable.

---

## Handoff — 2026-06-20T20:56:00+05:30 — Phase 0 [complete]


### Built and verified this session

- `docker-compose.yml`: Postgres 15-alpine, healthcheck, persistent volume
- `alembic/versions/0001_initial_schema.py`: all 9 tables, LISTEN/NOTIFY trigger, 5 indexes
- `backend/main.py`: FastAPI `POST /api/programs` → UUID insert
- `backend/db.py`: async SQLAlchemy + asyncpg session
- `backend/models.py`: Program ORM model
- `orchestrator/graph.py`: LangGraph 4-node stub (retrieve→extract→verify→narrate)
- `scripts/instructor_smoke.py`: Instructor+Gemini-2.5-flash one-field Pydantic extraction
- `tests/phase0_test.py`: 5 pytest DoD checks

Test run:
```
pytest tests/phase0_test.py -v
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.1.1
plugins: anyio-4.14.0, asyncio-1.4.0

tests/phase0_test.py::test_postgres_reachable_and_all_tables_exist PASSED [ 20%]
tests/phase0_test.py::test_post_programs_returns_uuid PASSED             [ 40%]
tests/phase0_test.py::test_uuid_is_real_row_in_programs PASSED           [ 60%]
tests/phase0_test.py::test_instructor_returns_parsed_pydantic_output PASSED [ 80%]
tests/phase0_test.py::test_langgraph_graph_compiles PASSED               [100%]

======================== 5 passed, 2 warnings in 8.38s ========================
```

### Decisions made and why

- `google-generativeai` (old SDK) kept for instructor compatibility — instructor 1.15.x
  `from_gemini()` requires `genai.GenerativeModel`, which is only in the old package.
  Migration to `google.genai` deferred to Phase 1 when we wire real extraction.
- `Mode.MD_JSON` replaces deprecated `Mode.GEMINI_JSON` (instructor >= 1.15).
- asyncpg DSN built from raw host/port/user/pass instead of transforming SYNC_DATABASE_URL
  — avoids breakage when the URL has driver prefixes like `+psycopg`.
- `alembic.ini` and SYNC_DATABASE_URL use `postgresql+psycopg://` — psycopg v3 (binary)
  is installed; psycopg2 is not.
- Gemini model: `gemini-2.5-flash` — confirmed available on this key via `list_models()`.
  Key starts with `AQ.` (internal/workspace key), not the public `AIza...` format.
  `gemini-1.5-flash` returned 404 on this key type.

### Deviated from SOLUTION.md / PHASES.md?
- none for Phase 0 scope.

### Exact next step
- Phase 1: Retriever — Tavily search (discovery) + Firecrawl fetch (page content).
  Start with `backend/retriever.py`: `discover_sources(program_name: str) -> list[Source]`
  using Tavily with source-type queries (FAQ, T&C, app review, press, forum).
  Tavily key: in .env as TAVILY_API_KEY. Firecrawl key: FIRECRAWL_API_KEY.
  Target: given a program name, return ≥5 URLs with source_type classification,
  stored in the `sources` table.

### Do not reconsider
- No Redis (Postgres LISTEN/NOTIFY replaces it entirely — settled in SOLUTION.md).
- 9 tables (not 7) — eval_ground_truth + redteam_tests added per SOLUTION.md Day 8-9 plan.
- psycopg v3 (not psycopg2) — matches requirements.txt, no reason to add the old driver.
- google-generativeai kept for now (instructor compatibility), migrate to google.genai in Phase 1.

### Open / blocked
- `google.generativeai` FutureWarning will remain until instructor is updated or we migrate
  to google.genai in Phase 1 extraction work. Non-blocking for Phase 0.
- Docker Desktop must be running manually before `docker compose up` and pytest.
  Consider adding a `wait_for_postgres` fixture in Phase 1 tests.
