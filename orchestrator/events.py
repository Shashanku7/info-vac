"""Pipeline event emission and program status helpers.

Separated from nodes.py so tests can patch emit_event independently
without importing the full node chain.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import text, update

# emit_event and set_status run inside asyncio.create_task() on the SAME
# event loop as FastAPI/uvicorn. Using the shared pool (AsyncSessionLocal) is
# safe here — and much faster than creating a new NullPool engine per call.
# (NullPool is reserved for tests and for discover_sources which runs in a
# thread executor via run_in_executor, where pool sharing is unsafe.)
from backend.db import AsyncSessionLocal
from backend.models import Program

log = structlog.get_logger(__name__)


async def emit_event(
    program_id: str,
    stage: str,
    progress: float,
    detail: str,
) -> None:
    """Insert a pipeline_events row.

    The Postgres trigger `trg_pipeline_event` fires pg_notify automatically,
    which SSE clients receive via asyncpg LISTEN on channel
    `pipeline_events_{program_id}`.
    """
    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                "INSERT INTO pipeline_events (program_id, stage, progress, detail) "
                "VALUES (:pid, :stage, :progress, :detail)"
            ),
            {
                "pid": uuid.UUID(program_id),
                "stage": stage,
                "progress": str(progress),
                "detail": detail,
            },
        )
        await session.commit()
    log.info("event_emitted", stage=stage, progress=progress, program_id=program_id)


async def set_status(
    program_id: str,
    status: str,
    error: str | None = None,
) -> None:
    """Update programs.status (and optionally error_message / completed_at)."""
    async with AsyncSessionLocal() as session:
        vals: dict[str, Any] = {"status": status}
        if error:
            vals["error_message"] = error[:2000]
        if status == "complete":
            vals["completed_at"] = datetime.now(timezone.utc)
        await session.execute(
            update(Program)
            .where(Program.id == uuid.UUID(program_id))
            .values(**vals)
        )
        await session.commit()
    log.info("status_updated", program_id=program_id, status=status)


async def set_trace_url(program_id: str, url: str) -> None:
    """Update programs.trace_url with a public LangSmith tracing URL.
    
    Robust try/except to prevent pipeline failure if the database column
    does not exist or has migration delays.
    """
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(
                update(Program)
                .where(Program.id == uuid.UUID(program_id))
                .values(trace_url=url)
            )
            await session.commit()
            log.info("trace_url_updated", program_id=program_id, url=url)
        except Exception as exc:
            log.warning("trace_url_update_failed", program_id=program_id, error=str(exc))


