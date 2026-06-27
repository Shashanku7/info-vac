"""Phase 4 orchestrator — live e2e test.

Requires:
  - docker compose up -d  (Postgres + schema migrated)
  - uvicorn backend.main:app --reload  (API running on localhost:8000)
  - .env with TAVILY_API_KEY, FIRECRAWL_API_KEY, GEMINI_API_KEY

Marker: @pytest.mark.live — skipped in default pytest run.
Phase-gate certification: pytest tests/test_orchestrator_e2e.py -m live -v -s

Human checkpoint: None — all assertions are automated.
"""
import asyncio
import uuid
import time

import httpx
import pytest

pytestmark = pytest.mark.live

BASE_URL = "http://localhost:8000"
TIME_LIMIT_SECONDS = 300  # 5-minute bound from Phase 4 DoD


# ---------------------------------------------------------------------------
# Test 1: End-to-end run completes within time bound
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_e2e_run_completes():
    """Full pipeline run via real API.

    DoD: programs.status = 'complete' within 5 minutes.
    Chosen program: 'Starbucks Rewards' — already verified in Phase 1.
    """
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=90) as client:
        # Step 1: Create program
        resp = await client.post("/api/programs", json={"name": "Starbucks Rewards"})
        assert resp.status_code == 200, f"Create failed: {resp.text}"
        program_id = resp.json()["id"]
        assert uuid.UUID(program_id)  # valid UUID

        # Step 2: Start pipeline
        resp = await client.post(f"/api/programs/{program_id}/run")
        assert resp.status_code == 202, f"Run failed: {resp.text}"

        # Step 3: Poll status until complete or timeout
        deadline = time.monotonic() + TIME_LIMIT_SECONDS
        final_status = None

        while time.monotonic() < deadline:
            await asyncio.sleep(3)
            resp = await client.get(f"/api/programs/{program_id}")
            assert resp.status_code == 200
            status = resp.json()["status"]
            print(f"  [{time.monotonic():.0f}s] status={status}", flush=True)

            if status in ("complete", "failed"):
                final_status = status
                break

        assert final_status is not None, (
            f"Pipeline did not finish within {TIME_LIMIT_SECONDS}s"
        )
        assert final_status == "complete", (
            f"Pipeline ended with status='{final_status}' — check programs.error_message in DB"
        )

        # Step 4: Verify the narrative was generated
        resp = await client.get(f"/api/programs/{program_id}/narrative")
        assert resp.status_code == 200, f"Failed to get narrative: {resp.text}"
        data = resp.json()
        assert "narrative" in data
        assert data["word_count"] >= 200
        print(f"  Narrative generated: {data['word_count']} words")



# ---------------------------------------------------------------------------
# Test 2: SSE stream emits events in correct stage order
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sse_events_in_correct_order():
    """Create a program, start pipeline, collect SSE events, assert order.

    Uses a separate program from test 1 to avoid state collision.
    Streams for up to 5 minutes; fails if terminal event never arrives.
    """
    EXPECTED_STAGES = [
        "retrieving", "retrieved",
        "extracting", "extracted",
        "verifying", "verified",
        "narrating", "complete",
    ]

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=90) as client:
        resp = await client.post("/api/programs", json={"name": "Marriott Bonvoy"})
        assert resp.status_code == 200
        program_id = resp.json()["id"]

    # Collect SSE events with a streaming client
    import json as _json
    collected_stages: list[str] = []

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=TIME_LIMIT_SECONDS + 10) as sse_client:
        async with sse_client.stream("GET", f"/api/programs/{program_id}/stream") as resp:
            assert resp.status_code == 200
            
            # Open stream FIRST, then trigger the pipeline so we don't miss the first event
            async with httpx.AsyncClient(base_url=BASE_URL, timeout=10) as run_client:
                run_resp = await run_client.post(f"/api/programs/{program_id}/run")
                assert run_resp.status_code == 202

            deadline = time.monotonic() + TIME_LIMIT_SECONDS
            async for line in resp.aiter_lines():
                if time.monotonic() > deadline:
                    break
                if not line.startswith("data:"):
                    continue
                payload = line[len("data:"):].strip()
                if not payload or payload == "{}":
                    continue
                try:
                    data = _json.loads(payload)
                    stage = data.get("stage", "")
                    if stage:
                        collected_stages.append(stage)
                        print(f"  SSE stage={stage}", flush=True)
                    if stage in ("complete", "failed"):
                        break
                except _json.JSONDecodeError:
                    pass

    # Check each expected stage appeared and in the right sequence
    key_stages = [s for s in collected_stages if s in EXPECTED_STAGES]
    assert key_stages == EXPECTED_STAGES, (
        f"SSE stage order mismatch.\n"
        f"Expected: {EXPECTED_STAGES}\n"
        f"Got:      {key_stages}\n"
        f"Full stream: {collected_stages}"
    )
