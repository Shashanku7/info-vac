"""FastAPI application — Phase 6: full pipeline + SSE + narrative + comparator.

Endpoints:
  POST /api/programs                    → create program row, return UUID
  POST /api/programs/{id}/run           → start background pipeline
  GET  /api/programs/{id}               → program status + metadata
  GET  /api/programs/{id}/stream        → SSE: live pipeline_events via pg LISTEN
  GET  /api/programs/{id}/narrative     → analyst brief (200-1000 words)
  POST /api/compare                     → two-program strategic comparison
  GET  /api/compare/{id}                → retrieve comparison result
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
from backend.models import Program, Narrative, Comparison
from backend.comparator import compare_programs
from orchestrator.graph import run_pipeline

app = FastAPI(
    title="InfoVac API",
    version="0.3.0",
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


class CompareRequest(BaseModel):
    program_a_id: uuid.UUID
    program_b_id: uuid.UUID


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

        def _on_notify(conn, pid, channel, payload: str):
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


@app.get("/api/programs/{program_id}/narrative")
async def get_narrative(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return the analyst brief for a completed program.

    Returns 404 if the narrative has not been generated yet (pipeline
    still running or narrative generation failed).
    """
    result = await db.execute(
        select(Narrative).where(Narrative.program_id == program_id)
    )
    narrative = result.scalar_one_or_none()
    if narrative is None:
        raise HTTPException(
            status_code=404,
            detail="Narrative not yet available. The pipeline may still be running.",
        )
    return {
        "program_id": str(program_id),
        "narrative": narrative.narrative_text,
        "word_count": narrative.word_count,
        "created_at": narrative.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Comparator endpoints (Phase 6)
# ---------------------------------------------------------------------------

@app.post("/api/compare", status_code=200)
async def create_comparison(body: CompareRequest, db: AsyncSession = Depends(get_db)):
    """Run a strategic comparison between two completed programs.

    Both programs must exist and be in 'complete' status.
    Returns the full comparison analysis.
    """
    # Validate both programs exist and are complete
    program_a = await db.get(Program, body.program_a_id)
    if program_a is None:
        raise HTTPException(status_code=404, detail=f"Program A not found: {body.program_a_id}")
    if program_a.status != "complete":
        raise HTTPException(
            status_code=409,
            detail=f"Program A is in status '{program_a.status}', must be 'complete'",
        )

    program_b = await db.get(Program, body.program_b_id)
    if program_b is None:
        raise HTTPException(status_code=404, detail=f"Program B not found: {body.program_b_id}")
    if program_b.status != "complete":
        raise HTTPException(
            status_code=409,
            detail=f"Program B is in status '{program_b.status}', must be 'complete'",
        )

    comparison = await compare_programs(
        str(body.program_a_id), str(body.program_b_id), db,
    )
    if comparison is None:
        raise HTTPException(status_code=500, detail="Comparison generation failed — see server logs.")

    await db.commit()
    return {
        "comparison_id": str(comparison.id),
        "program_a_id": str(comparison.program_a_id),
        "program_b_id": str(comparison.program_b_id),
        "analysis": comparison.analysis_json,
        "created_at": comparison.created_at.isoformat(),
    }


@app.get("/api/compare/{comparison_id}")
async def get_comparison(comparison_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve a previously generated comparison by its UUID."""
    comparison = await db.get(Comparison, comparison_id)
    if comparison is None:
        raise HTTPException(status_code=404, detail="Comparison not found.")
    return {
        "comparison_id": str(comparison.id),
        "program_a_id": str(comparison.program_a_id),
        "program_b_id": str(comparison.program_b_id),
        "analysis": comparison.analysis_json,
        "created_at": comparison.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Chat / RAG
# ---------------------------------------------------------------------------

from backend.chat import ChatRequest, handle_chat_message
from backend.models import Conversation, Message
from sqlalchemy import select

@app.post("/api/programs/{program_id}/chat")
async def chat_with_program(
    program_id: str,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Ask a question about a program using RAG."""
    return await handle_chat_message(program_id, body, db)


@app.get("/api/programs/{program_id}/chat")
async def get_chat_history(
    program_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve chat history for a program."""
    conv_res = await db.execute(
        select(Conversation).where(Conversation.program_id == uuid.UUID(program_id))
    )
    conv = conv_res.scalars().first()
    if not conv:
        return {"messages": []}
        
    msg_res = await db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.asc())
    )
    messages = msg_res.scalars().all()
    
    return {
        "conversation_id": str(conv.id),
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat()
            }
            for m in messages
        ]
    }
