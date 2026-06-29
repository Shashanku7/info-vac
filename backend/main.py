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
from datetime import datetime
from typing import AsyncGenerator, Optional

import asyncpg
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db import get_db
from backend.models import Program, Narrative, Comparison, ExtractedField, PipelineEvent, Source
from backend.comparator import compare_programs
from orchestrator.graph import run_pipeline

app = FastAPI(
    title="InfoVac API",
    version="0.3.0",
    description="Autonomous Competitive Intelligence Agent",
)

@app.on_event("startup")
async def startup_event():
    from sqlalchemy import text
    from backend.db import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(text("ALTER TABLE programs ADD COLUMN IF NOT EXISTS trace_url TEXT"))
            await session.commit()
        except Exception:
            pass

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
    force: bool = False  # if True, bypass dedup cache and run a fresh analysis


class ProgramResponse(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    trace_url: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CompareRequest(BaseModel):
    program_ids: list[uuid.UUID]


class ExtractedFieldResponse(BaseModel):
    id: uuid.UUID
    program_id: uuid.UUID
    category: str
    field_name: str
    field_value: Optional[str] = None
    is_null: bool
    claimed_snippet: Optional[str] = None
    gate_passed: Optional[bool] = None
    match_score: Optional[float] = None
    citation_start: Optional[int] = None
    citation_end: Optional[int] = None
    corroboration_score: Optional[float] = None
    authority_score: Optional[float] = None
    recency_score: Optional[float] = None
    confidence: Optional[float] = None
    source_id: Optional[uuid.UUID] = None
    source_url: Optional[str] = None
    access_date: Optional[datetime] = None
    contradiction_flag: bool
    contradiction_note: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PipelineEventResponse(BaseModel):
    id: str
    program_id: uuid.UUID
    stage: str
    progress: float
    detail: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/programs", response_model=list[ProgramResponse])
async def list_programs(db: AsyncSession = Depends(get_db)):
    """List all programs in the database."""
    result = await db.execute(select(Program).order_by(Program.created_at.desc()))
    return result.scalars().all()


@app.get("/api/fields", response_model=list[ExtractedFieldResponse])
async def list_all_fields(db: AsyncSession = Depends(get_db)):
    """Return latest extracted fields across all programs."""
    result = await db.execute(select(ExtractedField).order_by(ExtractedField.created_at.asc()))
    all_fields = result.scalars().all()
    
    # Group by program_id to apply get_latest_only per program
    by_program = {}
    for f in all_fields:
        by_program.setdefault(f.program_id, []).append(f)
        
    latest_fields = []
    for prog_id, fields in by_program.items():
        latest_fields.extend(ExtractedField.get_latest_only(fields))
        
    return latest_fields


@app.get("/api/programs/{program_id}/fields", response_model=list[ExtractedFieldResponse])
async def get_program_fields(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return all extracted fields for a program, keeping only the latest run per field_name."""
    result = await db.execute(
        select(ExtractedField, Source.url.label("source_url"))
        .outerjoin(Source, ExtractedField.source_id == Source.id)
        .where(ExtractedField.program_id == program_id)
    )
    
    fields = []
    for row in result.all():
        field_obj = row[0]
        field_obj.source_url = row[1]
        fields.append(field_obj)
        
    return ExtractedField.get_latest_only(fields)


@app.get("/api/programs/{program_id}/events", response_model=list[PipelineEventResponse])
async def get_program_events(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return all pipeline events for a program ordered sequentially."""
    result = await db.execute(
        select(PipelineEvent)
        .where(PipelineEvent.program_id == program_id)
        .order_by(PipelineEvent.created_at.asc(), PipelineEvent.id.asc())
    )
    events = result.scalars().all()
    response = []
    for e in events:
        try:
            p_val = float(e.progress) if e.progress else 0.0
        except ValueError:
            p_val = 0.0
        response.append(
            PipelineEventResponse(
                id=str(e.id),
                program_id=e.program_id,
                stage=e.stage,
                progress=p_val,
                detail=e.detail,
                created_at=e.created_at
            )
        )
    return response


@app.get("/api/programs/search", response_model=list[ProgramResponse])
async def search_programs(q: str, db: AsyncSession = Depends(get_db)):
    """Return completed programs whose name contains the query string (case-insensitive).
    Powers the 'similar programs found' modal in the frontend.
    """
    result = await db.execute(
        select(Program)
        .where(
            func.lower(Program.name).contains(func.lower(q.strip())),
            Program.status == "complete",
        )
        .order_by(Program.created_at.desc())
        .limit(8)
    )
    return result.scalars().all()


class SourceResponse(BaseModel):
    id: uuid.UUID
    url: str
    source_type: str
    title: Optional[str] = None
    fetch_status: str
    fetched_at: datetime

    model_config = {"from_attributes": True}


@app.get("/api/programs/{program_id}/sources", response_model=list[SourceResponse])
async def get_program_sources(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return all crawled sources for a program (used by the Sources tab in the UI)."""
    result = await db.execute(
        select(Source)
        .where(Source.program_id == program_id)
        .order_by(Source.fetched_at.asc())
    )
    return result.scalars().all()


@app.post("/api/programs", response_model=ProgramResponse, status_code=200)
async def create_program(body: ProgramCreate, db: AsyncSession = Depends(get_db)):
    """Create a program row and return its UUID. Does NOT start the pipeline.
    
    Smart deduplication: if a program with the same name (case-insensitive)
    already exists with status 'complete', return it immediately — no re-crawl needed.
    """
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="name must not be empty")
    
    name_clean = body.name.strip()

    # Check for an existing completed program with the same name (case-insensitive)
    # Skip this check if force=True (user wants a fresh re-analysis)
    if not body.force:
        existing_res = await db.execute(
            select(Program)
            .where(
                func.lower(Program.name) == func.lower(name_clean),
                Program.status == "complete",
            )
            .order_by(Program.created_at.desc())
            .limit(1)
        )
        existing = existing_res.scalars().first()
        if existing:
            # Return the cached complete program — frontend will skip the pipeline
            return existing

    program = Program(name=name_clean)
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

