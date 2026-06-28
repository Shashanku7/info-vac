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
from backend.extractor import extract_fields, ExtractedSchema, retry_failed_fields
from backend.gate import gate_verify, find_best_source_for_quote, gate_verify_multi_source
from backend.models import ExtractedField
from backend.narrator import generate_narrative
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
            "raw_html": (s.raw_html or "")[:30_000] if s.raw_html else None,
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
# Node 1.5: Embed (Phase 7 RAG)
# ---------------------------------------------------------------------------

async def embed_node(state: PipelineState) -> PipelineState:
    """Chunk source text and embed into Qdrant for RAG Chat."""
    if state.get("error"):
        return state

    program_id = state["program_id"]
    source_dicts = state.get("source_dicts", [])

    await emit_event(program_id, "embedding", 0.28, "Chunking and embedding raw source text for Chat Q&A")
    await set_status(program_id, "embedding")

    try:
        from backend.qdrant_client import get_qdrant_client, ensure_collection
        from backend.embeddings import chunk_text, embed_texts
        from qdrant_client.http import models
        from sklearn.feature_extraction.text import TfidfVectorizer
        import scipy.sparse
        import asyncio, uuid
        
        client = get_qdrant_client()
        ensure_collection(client)
        
        # 1. Gather all chunks
        chunk_data = []
        for src in source_dicts:
            raw_text = src.get("raw_content")
            if not raw_text:
                continue
                
            chunks = chunk_text(raw_text)
            for chunk_str in chunks:
                chunk_data.append({"src": src, "text": chunk_str})
                
        if not chunk_data:
            return {**state, "error": None}

        all_texts = [cd["text"] for cd in chunk_data]
        
        # 2. Get dense embeddings in one batch
        loop = asyncio.get_running_loop()
        vectors = await loop.run_in_executor(None, embed_texts, all_texts)
        
        # 3. Fit local TF-IDF vectorizer for sparse vectors (BM25 replacement)
        vectorizer = TfidfVectorizer(stop_words='english')
        try:
            tfidf_matrix = vectorizer.fit_transform(all_texts)
        except Exception:
            tfidf_matrix = scipy.sparse.coo_matrix((len(all_texts), 1))

        # 4. Construct PointStruct list
        points = []
        for idx, (cd, vector) in enumerate(zip(chunk_data, vectors)):
            src = cd["src"]
            chunk_str = cd["text"]
            
            row = tfidf_matrix.getrow(idx).tocoo()
            indices = row.col.tolist()
            values = row.data.tolist()

            points.append(
                models.PointStruct(
                    id=uuid.uuid4().hex,
                    vector={
                        "": vector,
                        "sparse-text": models.SparseVector(
                            indices=indices,
                            values=values
                        )
                    },
                    payload={
                        "program_id": program_id,
                        "source_id": src["id"],
                        "source_url": src["url"],
                        "source_type": src.get("source_type", "homepage"),
                        "text": chunk_str
                    }
                )
            )
            
        if points:
            # Upsert in batches
            batch_size = 100
            for i in range(0, len(points), batch_size):
                await asyncio.get_running_loop().run_in_executor(
                    None, 
                    lambda p=points[i:i+batch_size]: client.upsert(collection_name="sources", points=p)
                )
            
    except Exception as exc:
        err = str(exc)[:400]
        log.error("embed_failed", program_id=program_id, error=err)
        await emit_event(program_id, "embed_warning", 0.29, f"Vector embedding failed (chat may degrade): {err}")
        
    return state


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
            self.raw_html = d.get("raw_html")  # HTML tables for TierSystem

    proxies = [_Proxy(d) for d in source_dicts]

    try:
        loop = asyncio.get_running_loop()
        schema = await loop.run_in_executor(
            None, extract_fields, program_name, proxies, program_id, loop
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
# Semantic LLM Judge Helper
# ---------------------------------------------------------------------------

def _call_llm_judge(field_name: str, value: str, quote: str, context: str) -> bool:
    """Verify if the quote is semantically present in context, allowing minor formatting differences."""
    from backend.extractor import _make_client
    try:
        client, model_name = _make_client()
        prompt = (
            f"You are an automated citation judge.\n"
            f"Field Name: {field_name}\n"
            f"Claimed Value: {value}\n"
            f"Evidence Quote: {quote}\n\n"
            f"Is this Evidence Quote semantically and factually present in the document text below, "
            f"even if there are minor spacing, punctuation, or formatting differences?\n"
            f"Answer with exactly 'YES' or 'NO' and nothing else.\n\n"
            f"=== DOCUMENT TEXT ===\n"
            f"{context[:15000]}\n"
        )
        kwargs = {
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0,
        }
        if model_name and not model_name.startswith("gemini"):
            kwargs["model"] = model_name

        res = client.client.chat.completions.create(**kwargs)
        answer = res.choices[0].message.content.strip().upper()
        return "YES" in answer
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Node 3: Verify (gate + confidence)
# ---------------------------------------------------------------------------

async def verify_node(state: PipelineState) -> PipelineState:
    if state.get("error"):
        return state

    program_id   = state["program_id"]
    program_name = state["program_name"]
    schema_dict  = state.get("extracted_schema") or {}
    source_dicts = state["source_dicts"]
    total_sources = len(source_dicts)

    await emit_event(program_id, "verifying", 0.60,
                     "Running citation-verification gate")
    await set_status(program_id, "verifying")

    url_to_source = {d["url"]: d for d in source_dicts}
    field_rows    = iter_fields(schema_dict)

    async def run_judge_if_borderline(gate_res, val, quote, content, fnm):
        if not gate_res.passed and quote and val is not None:
            if 0.70 <= gate_res.match_score <= 0.94:
                try:
                    loop = asyncio.get_running_loop()
                    is_match = await loop.run_in_executor(
                        None, _call_llm_judge, fnm, str(val), quote, content
                    )
                    if is_match:
                        log.info("gate_passed_via_llm_judge", field=fnm, score=gate_res.match_score)
                        gate_res.passed = True
                        gate_res.matched_value = val
                        gate_res.rejection_reason = None
                except Exception as je:
                    log.error("llm_judge_failed", field=fnm, error=str(je))
        return gate_res

    # ---- Phase 1: Process every field; auto re-attribute on wrong URL --------
    #
    # Each entry: (cat_key, field_name, gate_result, matched_source_id,
    #              (conf, corr, auth, rec), original_evidence_quote)
    field_results: list[tuple] = []
    # Fields that still fail even after multi-source scan → eligible for LLM retry
    retry_needed: dict[str, list[str]] = {}  # {cat_key: [field_name, ...]}

    for idx, (cat_key, field_name, ev_dict) in enumerate(field_rows):
        value          = ev_dict.get("value")
        evidence_quote = ev_dict.get("evidence_quote")
        source_url     = ev_dict.get("source_url")
        matched_source_id: str | None = None

        # Emit field-level verification progress
        progress_val = 0.60 + 0.10 * ((idx + 1) / len(field_rows))
        await emit_event(
            program_id,
            "verifying",
            progress_val,
            f"Verifying field {idx+1}/{len(field_rows)}: {cat_key}.{field_name}"
        )

        # Multi-source segment verification gate (Problem 2)
        gate_result, matched_url, matched_id = gate_verify_multi_source(
            field_name=f"{cat_key}.{field_name}",
            claimed_value=value,
            evidence_quote=evidence_quote,
            url_to_source=url_to_source,
        )

        # Update attribution if a valid source matched
        if gate_result.passed:
            if matched_url:
                source_url = matched_url
                matched_source_id = matched_id
        else:
            # Check the claimed source if we need a fallback for borderline judge
            if source_url and source_url in url_to_source:
                matched_source_id = url_to_source[source_url].get("id")

        matched_content = ""
        if source_url and source_url in url_to_source:
            matched_content = url_to_source[source_url].get("raw_content", "")

        gate_result = await run_judge_if_borderline(
            gate_result, value, evidence_quote, matched_content, f"{cat_key}.{field_name}"
        )

        # ---- Mark for LLM retry if still failing with a non-null value -----
        if not gate_result.passed and value is not None:
            retry_needed.setdefault(cat_key, []).append(field_name)

        # ---- Confidence scoring for gate-passed fields ----------------------
        conf_num = corr_num = auth_num = rec_num = None
        if gate_result.passed and value and matched_source_id:
            src       = url_to_source.get(source_url or "", {})
            fetched_s = src.get("fetched_at")
            fetched   = datetime.fromisoformat(fetched_s) if fetched_s else None
            vr = compute_confidence(
                [SourceEvidence(matched_source_id,
                                src.get("source_type", "unknown"),
                                value, fetched)],
                total_sources,
            )
            conf_num = round(vr.confidence, 4)
            corr_num = round(vr.corroboration_score, 4)
            auth_num = round(vr.authority_score, 4)
            rec_num  = round(vr.recency_score, 4)

        field_results.append((
            cat_key, field_name, gate_result, matched_source_id,
            (conf_num, corr_num, auth_num, rec_num), evidence_quote,
        ))

    # ---- Phase 2: One LLM retry pass for still-failing fields ---------------
    retry_updates: dict[str, dict[str, dict]] = {}
    retry_cost = 0.0
    if retry_needed:
        class _SrcProxy:
            def __init__(self, d: dict):
                self.url         = d["url"]
                self.source_type = d["source_type"]
                self.raw_content = d.get("raw_content", "")
                self.raw_html    = d.get("raw_html")

        proxies = [_SrcProxy(d) for d in source_dicts]
        loop    = asyncio.get_running_loop()
        res_tuple = await loop.run_in_executor(
            None, retry_failed_fields, program_name, proxies, retry_needed, program_id, loop
        )
        if isinstance(res_tuple, tuple):
            retry_updates, retry_cost = res_tuple
        else:
            retry_updates, retry_cost = res_tuple, 0.0

        log.info("retry_pass_done",
                 retried=sum(len(v) for v in retry_needed.values()),
                 categories=list(retry_needed.keys()),
                 cost_usd=retry_cost)

    # ---- Phase 3: Merge retry results, apply gate, write DB -----------------
    gate_passed_count = gate_rejected_count = 0

    async with AsyncSessionLocal() as session:
        for (cat_key, field_name, gate_result, matched_source_id,
             scores, orig_quote) in field_results:

            final_gate   = gate_result
            final_src_id = matched_source_id
            final_quote  = orig_quote
            conf_num, corr_num, auth_num, rec_num = scores

            # Integrate retry result if we got one and original gate failed
            if (not gate_result.passed
                    and cat_key in retry_updates
                    and field_name in retry_updates[cat_key]):
                rev = retry_updates[cat_key][field_name]
                rv, rq, ru = (rev.get("value"),
                              rev.get("evidence_quote"),
                              rev.get("source_url"))

                r_gate, r_matched_url, r_matched_id = gate_verify_multi_source(
                    field_name=f"{cat_key}.{field_name} [retry]",
                    claimed_value=rv,
                    evidence_quote=rq,
                    url_to_source=url_to_source,
                )
                if r_gate.passed:
                    final_gate   = r_gate
                    final_src_id = r_matched_id
                    final_quote  = rq
                    # Recompute confidence for retry-sourced value
                    if rv and final_src_id:
                        src   = url_to_source.get(r_matched_url or ru or "", {})
                        f_str = src.get("fetched_at")
                        f_dt  = datetime.fromisoformat(f_str) if f_str else None
                        vr2   = compute_confidence(
                            [SourceEvidence(final_src_id,
                                            src.get("source_type", "unknown"),
                                            rv, f_dt)],
                            total_sources,
                        )
                        conf_num = round(vr2.confidence, 4)
                        corr_num = round(vr2.corroboration_score, 4)
                        auth_num = round(vr2.authority_score, 4)
                        rec_num  = round(vr2.recency_score, 4)
                    log.info("retry_gate_passed",
                             field=field_name, category=cat_key)

            # Compute citation character offsets if passed
            c_start = None
            c_end = None
            access_dt = None
            if final_gate.passed and final_quote and final_src_id:
                src_dict = None
                for s_d in source_dicts:
                    if s_d.get("id") == final_src_id:
                        src_dict = s_d
                        break
                if src_dict:
                    src_content = src_dict.get("raw_content", "")
                    idx = src_content.find(final_quote)
                    if idx == -1:
                        idx = src_content.lower().find(final_quote.lower())
                    if idx != -1:
                        c_start = idx
                        c_end = idx + len(final_quote)
                    
                    f_str = src_dict.get("fetched_at")
                    if f_str:
                        try:
                            access_dt = datetime.fromisoformat(f_str)
                        except Exception:
                            pass

            if final_gate.passed:
                gate_passed_count += 1
            else:
                gate_rejected_count += 1
                # Log forced null in analytics
                log.info(
                    "analytics_null_forced",
                    program_id=program_id,
                    category=cat_key,
                    field=field_name,
                    reason="gate_failed",
                )

            row = ExtractedField(
                id=uuid.uuid4(),
                program_id=uuid.UUID(program_id),
                category=cat_key,
                field_name=field_name,
                field_value=final_gate.matched_value,
                is_null=(final_gate.matched_value is None),
                claimed_snippet=final_quote,
                gate_passed=(
                    None if (final_gate.matched_value is None and final_gate.passed)
                    else final_gate.passed
                ),
                match_score=round(final_gate.match_score, 4),
                citation_start=c_start,
                citation_end=c_end,
                corroboration_score=corr_num,
                authority_score=auth_num,
                recency_score=rec_num,
                confidence=conf_num,
                source_id=(uuid.UUID(final_src_id) if final_src_id else None),
                access_date=access_dt,
            )
            session.add(row)
            try:
                await session.flush()
            except IntegrityError:
                await session.rollback()
                log.debug("field_upsert_skipped", field=field_name)

        # Update program's total_cost
        from backend.models import Program
        from decimal import Decimal
        program = await session.get(Program, uuid.UUID(program_id))
        if program:
            ext_cost = Decimal(str(schema_dict.get("extraction_cost", 0.0) or 0.0))
            ret_cost = Decimal(str(retry_cost))
            program.total_cost = (program.total_cost or Decimal("0.0")) + ext_cost + ret_cost

        await session.commit()

    retry_note = (
        f" ({sum(len(v) for v in retry_needed.values())} LLM-retried)"
        if retry_needed else ""
    )
    await emit_event(program_id, "verified", 0.80,
                     f"Gate: {gate_passed_count} passed, "
                     f"{gate_rejected_count} rejected{retry_note}")
    return {**state, "error": None}


# ---------------------------------------------------------------------------
# Node 4: Narrate (Phase 5)
# ---------------------------------------------------------------------------

async def narrate_node(state: PipelineState) -> PipelineState:
    """Generate the analyst brief from gate-verified extracted_fields.

    Non-blocking: if narrative generation fails, the pipeline still completes
    successfully. The brief is stored in the narratives table.
    """
    if state.get("error"):
        return state

    program_id = state["program_id"]

    await emit_event(program_id, "narrating", 0.85,
                     "Generating analyst competitive brief")
    await set_status(program_id, "narrating")

    async with AsyncSessionLocal() as session:
        narrative = await generate_narrative(program_id, session)
        if narrative is not None:
            await session.commit()
            detail = f"Narrative ready — {narrative.word_count} words"
        else:
            detail = "Pipeline complete (narrative generation failed — see logs)"

    await emit_event(program_id, "complete", 1.0, detail)
    await set_status(program_id, "complete")
    return state
