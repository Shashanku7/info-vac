"""Phase 0 Definition-of-Done tests.

All five tests must pass for Phase 0 to be complete.

Prerequisites:
  1. docker compose up -d   (Postgres running)
  2. alembic upgrade head   (schema migrated)
  3. uvicorn backend.main:app --host 0.0.0.0 --port 8000 &  (API running)
  4. .env with valid ANTHROPIC_API_KEY

Run:
    pytest tests/phase0_test.py -v
"""
import os
import sys
import uuid
import asyncio

import pytest
import pytest_asyncio
import httpx
import asyncpg
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")

# asyncpg DSN — built from explicit parts to avoid driver-prefix issues
# (SYNC_DATABASE_URL may have +psycopg prefix which asyncpg doesn't understand)
_db_host = os.getenv("DB_HOST", "localhost")
_db_port = int(os.getenv("DB_PORT", "5432"))
_db_user = os.getenv("DB_USER", "infovac")
_db_pass = os.getenv("DB_PASS", "infovac_dev")
_db_name = os.getenv("DB_NAME", "infovac")
ASYNCPG_DSN = f"postgresql://{_db_user}:{_db_pass}@{_db_host}:{_db_port}/{_db_name}"

# Expected tables (7 core + 2 evidence tables = 9 total, but DoD says "all 7 tables exist"
# — the spec was written before eval/redteam were added; we check all 9 to be safe)
EXPECTED_TABLES = {
    "programs",
    "sources",
    "extracted_fields",
    "narratives",
    "comparisons",
    "conversations",
    "pipeline_events",
    "eval_ground_truth",
    "redteam_tests",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_asyncpg_conn():
    return await asyncpg.connect(ASYNCPG_DSN)


# ---------------------------------------------------------------------------
# Test 1 — Postgres reachable and all tables exist
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_postgres_reachable_and_all_tables_exist():
    """DoD: docker compose up → Postgres reachable, all 9 tables exist."""
    conn = await _get_asyncpg_conn()
    try:
        rows = await conn.fetch(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            """
        )
        existing = {r["table_name"] for r in rows}
        missing = EXPECTED_TABLES - existing
        assert not missing, f"Missing tables: {missing}"
    finally:
        await conn.close()


# ---------------------------------------------------------------------------
# Test 2 — POST /api/programs returns 200 + valid UUID
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_post_programs_returns_uuid():
    """DoD: curl -X POST localhost:8000/api/programs -d '{"name":"Test"}' → 200 + valid UUID."""
    async with httpx.AsyncClient(base_url=API_BASE, timeout=10) as client:
        response = await client.post(
            "/api/programs",
            json={"name": "Test"},
        )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "id" in data, f"Response missing 'id': {data}"
    # Will raise ValueError if not a valid UUID
    parsed_id = uuid.UUID(data["id"])
    assert parsed_id.version == 4, f"Expected UUID v4, got version {parsed_id.version}"
    assert data["name"] == "Test"
    assert data["status"] == "pending"

    # Stash the ID for the next test — use module-level storage
    test_post_programs_returns_uuid._last_id = str(parsed_id)


# ---------------------------------------------------------------------------
# Test 3 — The UUID is a real row in programs
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_uuid_is_real_row_in_programs():
    """DoD: that UUID is a real row in programs."""
    # Run POST first to get a fresh UUID (tests may run in any order)
    async with httpx.AsyncClient(base_url=API_BASE, timeout=10) as client:
        response = await client.post("/api/programs", json={"name": "RowCheck"})
    assert response.status_code == 200
    program_id = response.json()["id"]

    conn = await _get_asyncpg_conn()
    try:
        row = await conn.fetchrow(
            "SELECT id, name, status FROM programs WHERE id = $1",
            uuid.UUID(program_id),
        )
        assert row is not None, f"No row found in programs for id={program_id}"
        assert row["name"] == "RowCheck"
        assert row["status"] == "pending"
    finally:
        await conn.close()


# ---------------------------------------------------------------------------
# Test 4 — Instructor+Claude returns valid parsed Pydantic output
# ---------------------------------------------------------------------------

def test_instructor_returns_parsed_pydantic_output():
    """DoD: standalone script → one Instructor+Gemini call returns valid parsed Pydantic output, not raw text."""
    # Import and call the smoke test function directly
    # This avoids needing the API or Docker running
    try:
        from scripts.instructor_smoke import run_smoke_test, ProgramName
    except ImportError:
        # Try adding project root to path
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from scripts.instructor_smoke import run_smoke_test, ProgramName

    result = run_smoke_test()
    assert isinstance(result, ProgramName), (
        f"Expected ProgramName instance, got {type(result)}: {result!r}"
    )
    assert isinstance(result.name, str), f"name field must be a string, got {type(result.name)}"
    assert len(result.name) > 0, "name field must not be empty"
    # Must NOT be raw text (i.e., not the raw JSON string)
    assert not result.name.startswith("{"), "name looks like raw JSON — Instructor did not parse"


# ---------------------------------------------------------------------------
# Test 5 — LangGraph graph compiles without error
# ---------------------------------------------------------------------------

def test_langgraph_graph_compiles():
    """DoD-adjacent: LangGraph stub graph imports and compiles correctly."""
    try:
        from orchestrator.graph import graph, PipelineState
    except ImportError:
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from orchestrator.graph import graph, PipelineState

    # The graph object is compiled at module import — if we got here, it worked
    assert graph is not None, "graph is None — build_graph() returned nothing"

    # Verify it's invokable (invoke with a minimal state)
    initial_state: PipelineState = {
        "program_id": "test-id",
        "program_name": "Test Program",
        "sources": [],
        "extracted_fields": {},
        "narrative": "",
    }
    result = graph.invoke(initial_state)
    # Pass-through nodes should return state unchanged
    assert result["program_id"] == "test-id"
    assert result["program_name"] == "Test Program"
