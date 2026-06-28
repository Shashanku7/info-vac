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
    program_ids: list[uuid.UUID]


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
    """Run a strategic comparison between multiple completed programs.

    All programs must exist, be in 'complete' status, and there must be at least 2 programs.
    Returns the full comparison analysis.
    """
    if len(body.program_ids) < 2:
        raise HTTPException(status_code=400, detail="Comparison requires at least 2 program IDs.")

    p_ids_str = []
    for pid in body.program_ids:
        prog = await db.get(Program, pid)
        if prog is None:
            raise HTTPException(status_code=404, detail=f"Program not found: {pid}")
        if prog.status != "complete":
            raise HTTPException(
                status_code=409,
                detail=f"Program {prog.name} is in status '{prog.status}', must be 'complete'",
            )
        p_ids_str.append(str(pid))

    comparison = await compare_programs(p_ids_str, db)
    if comparison is None:
        raise HTTPException(status_code=500, detail="Comparison generation failed — see server logs.")

    await db.commit()
    return {
        "comparison_id": str(comparison.id),
        "program_ids": [str(p) for p in comparison.program_ids] if comparison.program_ids else [str(comparison.program_a_id), str(comparison.program_b_id)],
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


# ---------------------------------------------------------------------------
# Program Evolution Changelog Endpoint
# ---------------------------------------------------------------------------

from typing import Optional, Any
from pydantic import Field
from backend.models import ExtractedField
from backend.extractor import _make_client

class ChangelogItem(BaseModel):
    category: str = Field(description="Category of the field (e.g., 'earn_mechanics')")
    field_name: str = Field(description="Name of the field")
    old_value: Optional[str] = Field(description="Old value")
    new_value: Optional[str] = Field(description="New value")
    change_type: str = Field(description="Type of change: 'upgraded', 'devalued', 'altered', or 'none'")
    analysis: str = Field(description="Factual analysis of what changed and the strategic impact")

class EvolutionOutput(BaseModel):
    executive_summary: str = Field(description="High-level analysis of how the loyalty program evolved over time.")
    changelog: list[ChangelogItem] = Field(description="List of specific changes between oldest and newest runs.")

@app.get("/api/programs/{program_id}/evolution")
async def get_program_evolution(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Analyze changes in program fields over time (oldest run vs. newest run)."""
    program = await db.get(Program, program_id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")

    fields_res = await db.execute(
        select(ExtractedField).where(
            ExtractedField.program_id == program_id,
            ExtractedField.gate_passed == True
        ).order_by(ExtractedField.created_at.asc())
    )
    all_fields = list(fields_res.scalars().all())
    
    if not all_fields:
        raise HTTPException(status_code=404, detail="No extraction data found for this program.")

    by_field = {}
    for f in all_fields:
        by_field.setdefault(f.field_name, []).append(f)

    diff_lines = []
    for field_name, run_list in by_field.items():
        oldest = run_list[0]
        newest = run_list[-1]
        
        old_val = str(oldest.field_value) if oldest.field_value is not None else "null"
        new_val = str(newest.field_value) if newest.field_value is not None else "null"
        
        if oldest.id != newest.id:
            diff_lines.append(
                f"- Category: {oldest.category}\n"
                f"  Field: {field_name}\n"
                f"  Old Value (extracted {oldest.created_at.isoformat()}): {old_val}\n"
                f"  New Value (extracted {newest.created_at.isoformat()}): {new_val}\n"
            )
            
    if not diff_lines:
        return {
            "executive_summary": "No changes detected. The program has only been run once, or no fields have evolved.",
            "changelog": []
        }

    grounded_context = "\n".join(diff_lines)
    prompt = (
        "You are a loyalty program analyst. Your task is to write a structured evolution changelog.\n"
        "Here is the diff comparing the oldest extraction run against the newest run for this program:\n\n"
        f"{grounded_context}\n\n"
        "Analyze these differences and output a structured changelog specifying if they represent upgrades, "
        "devaluations, alterations, or no change, and write a professional strategic analysis for each."
    )
    
    client, model_name = _make_client()
    kwargs = {
        "response_model": EvolutionOutput,
        "messages": [
            {"role": "system", "content": "You are a competitive intelligence analyst. Write a strategic evolution changelog."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.0,
    }
    if model_name and not model_name.startswith("gemini"):
        kwargs["model"] = model_name

    loop = asyncio.get_running_loop()
    def _call_llm():
        return client.chat.completions.create(**kwargs)

    res = await loop.run_in_executor(None, _call_llm)
    return res.model_dump()
