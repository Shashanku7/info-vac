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
- Robots.txt: async httpx GET /robots.txt + urllib.robotparser before every Firecrawl call; allow on error (don't block on ambiguity)
- Source-type classification: query-of-origin is the primary signal; URL pattern matching is a secondary override (app store URLs → app_review regardless of which query found them)
- Fake program test: assert list returned (possibly empty), assert no exception — Tavily may still return tangentially related results for any query

### Exact next step
- Creating: backend/models.py (add Source), backend/retriever.py, tests/conftest.py, tests/test_retriever.py, scripts/run_retriever.py

### Do not reconsider
- (see Phase 0 entry below)

### Open / blocked
- none

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
