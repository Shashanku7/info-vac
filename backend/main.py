"""FastAPI application — Phase 4: full pipeline + SSE.

Endpoints:
  POST /api/programs             → create program row, return UUID
  POST /api/programs/{id}/run   → start background pipeline
  GET  /api/programs/{id}       → program status + metadata
  GET  /api/programs/{id}/stream → SSE: live pipeline_events via pg LISTEN
"""
import asyncio
import json
import os
import uuid
from typing import AsyncGenerator

import asyncpg
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db import get_db
from backend.models import Program
from orchestrator.graph import run_pipeline

app = FastAPI(
    title="InfoVac API",
    version="0.2.0",
    description="Autonomous Competitive Intelligence Agent",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_ASYNCPG_DSN = os.getenv(
    "ASYNCPG_DSN",
    "postgresql://infovac:infovac_dev@localhost:5432/infovac",
)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ProgramCreate(BaseModel):
    name: str


class ProgramResponse(BaseModel):
    id: uuid.UUID
    name: str
    status: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/programs", response_model=ProgramResponse, status_code=200)
async def create_program(body: ProgramCreate, db: AsyncSession = Depends(get_db)):
    """Create a program row and return its UUID. Does NOT start the pipeline."""
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="name must not be empty")
    program = Program(name=body.name.strip())
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program


@app.post("/api/programs/{program_id}/run", status_code=202)
async def run_program(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Start the background pipeline for an existing program."""
    program = await db.get(Program, program_id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    if program.status not in ("pending", "failed"):
        raise HTTPException(
            status_code=409,
            detail=f"Program is already in status '{program.status}'"
        )
    asyncio.create_task(
        run_pipeline(str(program_id), program.name)
    )
    return {"status": "accepted", "program_id": str(program_id)}


@app.get("/api/programs/{program_id}", response_model=ProgramResponse)
async def get_program(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return program status and metadata."""
    program = await db.get(Program, program_id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


@app.get("/api/programs/{program_id}/stream")
async def stream_program(program_id: uuid.UUID):
    """SSE stream of pipeline_events for this program.

    Uses asyncpg LISTEN directly (not SQLAlchemy) so notifications arrive
    as push events rather than polling. The stream closes automatically when
    a 'complete' or 'failed' stage event is received.
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        conn: asyncpg.Connection | None = None
        queue: asyncio.Queue = asyncio.Queue()

        def _on_notify(_, __, payload: str):
            queue.put_nowait(payload)

        try:
            conn = await asyncpg.connect(_ASYNCPG_DSN)
            channel = f"pipeline_events_{program_id}"
            await conn.add_listener(channel, _on_notify)

            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    yield "event: heartbeat\ndata: {}\n\n"
                    continue

                yield f"event: stage_update\ndata: {payload}\n\n"

                try:
                    data = json.loads(payload)
                    if data.get("stage") in ("complete", "failed"):
                        break
                except (json.JSONDecodeError, KeyError):
                    pass
        finally:
            if conn:
                try:
                    await conn.remove_listener(channel, _on_notify)
                    await conn.close()
                except Exception:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

