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
