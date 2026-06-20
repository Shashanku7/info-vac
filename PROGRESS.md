## Handoff — 2026-06-20T15:00:00+05:30 — Phase 0 [in progress]

### Built and verified this session
- PROGRESS.md: initialized
- Implementation plan: written (see artifact)

### Decisions made and why
- Using asyncpg + SQLAlchemy async for DB (matches requirements.txt)
- Alembic for migrations (not raw SQL) so upgrade head is idempotent and testable
- LangGraph stub graph: 4 pass-through nodes (retrieve, extract, verify, narrate) just to prove import + compile works
- Instructor smoke test uses a one-field Pydantic model (ProgramName) to keep the call trivial
- pytest-asyncio for async test fixtures (DB checks require async)

### Deviated from SOLUTION.md / PHASES.md?
- none — Phase 0 scope is pure skeleton, no real logic added

### Exact next step
- Creating all source files (docker-compose.yml, .env, alembic config, backend/, orchestrator/, scripts/, tests/)
- Then: docker compose up → alembic upgrade head → uvicorn → pytest tests/phase0_test.py

### Do not reconsider
- No Redis in Phase 0 (or ever in MVP) — Postgres LISTEN/NOTIFY replaces it
- 9 tables total (7 core + eval_ground_truth + redteam_tests) all created in migration 0001

### Open / blocked
- ANTHROPIC_API_KEY must be set by user in .env before instructor_smoke test passes
- Docker must be running on host
