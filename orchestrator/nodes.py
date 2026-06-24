"""LangGraph node implementations — Phase 4.

Each node:
  1. Emits a pipeline_events row (→ pg_notify → SSE)
  2. Updates programs.status
  3. Catches its own exceptions → marks failed, short-circuits downstream nodes

Retry policy (retrieve_node only):
  tenacity AsyncRetrying, 3 attempts, exponential back-off 1→8 s.
  Covers transient Tavily / Firecrawl timeouts and network blips.
"""
from __future__ import annotations

import uuid
import asyncio
from datetime import datetime

import structlog
from sqlalchemy.exc import IntegrityError
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential

from backend.db import make_background_session, AsyncSessionLocal
from backend.extractor import extract_fields, ExtractedSchema
from backend.gate import gate_verify
from backend.models import ExtractedField
from backend.retriever import discover_sources
from backend.verifier import compute_confidence, SourceEvidence

from orchestrator.events import emit_event, set_status
from orchestrator.state import PipelineState, iter_fields

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Node 1: Retrieve
# ---------------------------------------------------------------------------

async def retrieve_node(state: PipelineState) -> PipelineState:
    program_id = state["program_id"]
    program_name = state["program_name"]

    await emit_event(program_id, "retrieving", 0.05,
                     f"Discovering sources for {program_name!r}")
    await set_status(program_id, "retrieving")

    sources = []
    try:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=1, max=8),
            reraise=True,
        ):
            with attempt:
                async with make_background_session() as session:
                    sources = await discover_sources(
                        program_name=program_name,
                        program_id=uuid.UUID(program_id),
                        db=session,
                    )
    except Exception as exc:
        err = str(exc)[:400]
        log.error("retrieve_failed", program_id=program_id, error=err)
        await emit_event(program_id, "failed", 0.0, f"Retrieval failed: {err}")
        await set_status(program_id, "failed", err)
        return {**state, "error": err, "source_dicts": []}

    source_dicts = [
        {
            "id": str(s.id),
            "url": s.url,
            "source_type": s.source_type,
            "raw_content": (s.raw_content or "")[:50_000],
            "fetch_method": s.fetch_method,
            "fetched_at": s.fetched_at.isoformat() if s.fetched_at else None,
        }
        for s in sources
    ]

    await emit_event(program_id, "retrieved", 0.25,
                     f"Stored {len(sources)} sources "
                     f"(types: {sorted({s.source_type for s in sources})})")
    return {**state, "source_dicts": source_dicts, "error": None}


# ---------------------------------------------------------------------------
# Node 2: Extract
# ---------------------------------------------------------------------------

async def extract_node(state: PipelineState) -> PipelineState:
    if state.get("error"):
        return state

    program_id = state["program_id"]
    program_name = state["program_name"]
    source_dicts = state["source_dicts"]

    await emit_event(program_id, "extracting", 0.30,
                     f"Extracting fields from {len(source_dicts)} sources")
    await set_status(program_id, "extracting")

    class _Proxy:
        def __init__(self, d: dict):
            self.id = d["id"]
            self.url = d["url"]
            self.source_type = d["source_type"]
            self.raw_content = d.get("raw_content", "")

    proxies = [_Proxy(d) for d in source_dicts]

    try:
        loop = asyncio.get_running_loop()
        schema: ExtractedSchema = await loop.run_in_executor(
            None,
            extract_fields,
            program_name,
            proxies,
        )
        schema_dict = schema.model_dump()
    except Exception as exc:
        err = str(exc)[:400]
        log.error("extract_failed", program_id=program_id, error=err)
        await emit_event(program_id, "failed", 0.0, f"Extraction failed: {err}")
        await set_status(program_id, "failed", err)
        return {**state, "error": err, "extracted_schema": None}

    await emit_event(program_id, "extracted", 0.55,
                     "Extraction complete — running citation gate")
    return {**state, "extracted_schema": schema_dict, "error": None}


# ---------------------------------------------------------------------------
# Node 3: Verify (gate + confidence)
# ---------------------------------------------------------------------------

async def verify_node(state: PipelineState) -> PipelineState:
    if state.get("error"):
        return state

    program_id = state["program_id"]
    schema_dict = state.get("extracted_schema") or {}
    source_dicts = state["source_dicts"]
    total_sources = len(source_dicts)

    await emit_event(program_id, "verifying", 0.60,
                     "Running citation-verification gate")
    await set_status(program_id, "verifying")

    url_to_source = {d["url"]: d for d in source_dicts}
    field_rows = iter_fields(schema_dict)
    gate_passed_count = gate_rejected_count = 0

    async with AsyncSessionLocal() as session:
        for cat_key, field_name, ev_dict in field_rows:
            value = ev_dict.get("value")
            evidence_quote = ev_dict.get("evidence_quote")
            source_url = ev_dict.get("source_url")

            # Pick best source to gate against
            source_content = ""
            matched_source_id: str | None = None
            if source_url and source_url in url_to_source:
                source_content = url_to_source[source_url].get("raw_content", "")
                matched_source_id = url_to_source[source_url].get("id")
            elif source_dicts:
                source_content = " ".join(
                    d.get("raw_content", "") for d in source_dicts[:5]
                )

            gate_result = gate_verify(
                field_name=f"{cat_key}.{field_name}",
                claimed_value=value,
                evidence_quote=evidence_quote,
                source_raw_content=source_content,
            )
            if gate_result.passed:
                gate_passed_count += 1
            else:
                gate_rejected_count += 1

            # Compute confidence for non-null gate-passed fields
            conf_num = corr_num = auth_num = rec_num = None
            if gate_result.passed and value and matched_source_id:
                src = url_to_source.get(source_url or "", {})
                fetched_str = src.get("fetched_at")
                fetched_at = (
                    datetime.fromisoformat(fetched_str) if fetched_str else None
                )
                vr = compute_confidence(
                    [SourceEvidence(matched_source_id,
                                    src.get("source_type", "unknown"),
                                    value, fetched_at)],
                    total_sources,
                )
                conf_num = round(vr.confidence, 4)
                corr_num = round(vr.corroboration_score, 4)
                auth_num = round(vr.authority_score, 4)
                rec_num  = round(vr.recency_score, 4)

            row = ExtractedField(
                id=uuid.uuid4(),
                program_id=uuid.UUID(program_id),
                category=cat_key,
                field_name=field_name,
                field_value=gate_result.matched_value,
                is_null=(gate_result.matched_value is None),
                claimed_snippet=evidence_quote,
                gate_passed=gate_result.passed,
                match_score=round(gate_result.match_score, 4),
                corroboration_score=corr_num,
                authority_score=auth_num,
                recency_score=rec_num,
                confidence=conf_num,
                source_id=(uuid.UUID(matched_source_id) if matched_source_id else None),
            )
            session.add(row)
            try:
                await session.flush()
            except IntegrityError:
                await session.rollback()
                log.debug("field_upsert_skipped", field=field_name)

        await session.commit()

    await emit_event(program_id, "verified", 0.80,
                     f"Gate: {gate_passed_count} passed, "
                     f"{gate_rejected_count} rejected")
    return {**state, "error": None}


# ---------------------------------------------------------------------------
# Node 4: Narrate (Phase 5 stub)
# ---------------------------------------------------------------------------

async def narrate_node(state: PipelineState) -> PipelineState:
    if state.get("error"):
        return state
    program_id = state["program_id"]
    await emit_event(program_id, "complete", 1.0,
                     "Pipeline complete (narrative: Phase 5)")
    await set_status(program_id, "complete")
    return state
