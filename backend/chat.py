import uuid
import asyncio
import structlog
from typing import Optional
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models import Conversation, Message, Source, ExtractedField, Narrative
from backend.extractor import _make_client
from backend.qdrant_client import get_qdrant_client
from backend.embeddings import chunk_text, embed_texts

logger = structlog.get_logger(__name__)

class ChatRequest(BaseModel):
    message: str
    source_type: Optional[str] = None  # Metadata filter (e.g. "tnc", "faq", "homepage", etc.)

class ChatResponse(BaseModel):
    conversation_id: str
    reply: str

def _sync_search_qdrant(
    program_id: str,
    query: str,
    all_chunks: list[str],
    limit: int = 20,
    source_type: Optional[str] = None
) -> list[dict]:
    """Embed query, compute sparse TF-IDF, and execute Qdrant RRF hybrid search."""
    query_vector = embed_texts([query])[0]
    client = get_qdrant_client()
    
    # 1. Compute sparse vector for query using TF-IDF fit on program chunks
    from sklearn.feature_extraction.text import TfidfVectorizer
    indices = []
    values = []
    if all_chunks:
        vectorizer = TfidfVectorizer(stop_words='english')
        try:
            vectorizer.fit(all_chunks)
            sparse_query = vectorizer.transform([query]).tocoo()
            indices = sparse_query.col.tolist()
            values = sparse_query.data.tolist()
        except Exception:
            pass

    # 2. Build filters
    from qdrant_client.http import models
    must_conditions = [
        models.FieldCondition(key="program_id", match=models.MatchValue(value=program_id))
    ]
    if source_type:
        must_conditions.append(
            models.FieldCondition(key="source_type", match=models.MatchValue(value=source_type))
        )
    query_filter = models.Filter(must=must_conditions)

    # 3. Hybrid search prefetching and RRF fusion
    try:
        response = client.query_points(
            collection_name="sources",
            prefetch=[
                models.Prefetch(
                    query=query_vector,
                    limit=limit
                ),
                models.Prefetch(
                    query=models.SparseVector(indices=indices, values=values),
                    using="sparse-text",
                    limit=limit
                )
            ],
            query=models.FusionQuery(
                fusion=models.Fusion.RRF
            ),
            query_filter=query_filter,
            limit=limit
        )
        return [
            {
                "text": hit.payload.get("text", ""),
                "source_url": hit.payload.get("source_url", "")
            }
            for hit in response.points
        ]
    except Exception as e:
        logger.warning("Hybrid search query failed, falling back to dense only", error=str(e))
        try:
            response = client.query_points(
                collection_name="sources",
                query=query_vector,
                query_filter=query_filter,
                limit=limit
            )
            return [
                {
                    "text": hit.payload.get("text", ""),
                    "source_url": hit.payload.get("source_url", "")
                }
                for hit in response.points
            ]
        except Exception as dense_exc:
            logger.error("Dense fallback search query also failed", error=str(dense_exc))
            return []

async def handle_chat_message(program_id: str, body: ChatRequest, db: AsyncSession) -> ChatResponse:
    # 1. Fetch or create conversation
    pid = uuid.UUID(program_id)
    conv_res = await db.execute(select(Conversation).where(Conversation.program_id == pid))
    conv = conv_res.scalars().first()
    if not conv:
        conv = Conversation(id=uuid.uuid4(), program_id=pid)
        db.add(conv)
        await db.flush()
        
    # 2. Save User Message
    user_msg = Message(id=uuid.uuid4(), conversation_id=conv.id, role="user", content=body.message)
    db.add(user_msg)
    await db.flush()
    
    # 3. Fetch Context from Postgres (Fields & Narrative & History)
    fields_res = await db.execute(
        select(ExtractedField).where(ExtractedField.program_id == pid, ExtractedField.gate_passed == True, ExtractedField.is_null == False)
    )
    fields = ExtractedField.get_latest_only(fields_res.scalars().all())
    fields_text = "\n".join([f"- {f.category}.{f.field_name}: {f.field_value}" for f in fields])
    
    nar_res = await db.execute(select(Narrative).where(Narrative.program_id == pid).order_by(Narrative.created_at.desc()))
    narrative = nar_res.scalars().first()
    nar_text = narrative.narrative_text if narrative else "No narrative available."
    
    msg_res = await db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.desc()).limit(10)
    )
    history = list(reversed(msg_res.scalars().all()))

    # Fetch all source documents for this program from database to build TF-IDF space
    sources_res = await db.execute(
        select(Source).where(Source.program_id == pid)
    )
    sources = sources_res.scalars().all()
    all_chunks = []
    for src in sources:
        if src.raw_content:
            all_chunks.extend(chunk_text(src.raw_content))
    
    # 4. Fetch Context from Qdrant with Hybrid RRF Search
    loop = asyncio.get_running_loop()
    chunks_data = await loop.run_in_executor(
        None, 
        _sync_search_qdrant, 
        program_id, 
        body.message, 
        all_chunks, 
        20, 
        body.source_type
    )

    # 5. Cross-Encoder Reranking using sentence-transformers
    final_chunks = []
    is_degraded_mode = False
    if chunks_data:
        from sentence_transformers import CrossEncoder
        try:
            logger.info("Initializing Cross-Encoder for reranking...")
            reranker = CrossEncoder("BAAI/bge-reranker-base")
            
            # Score each candidate chunk
            pairs = [[body.message, c["text"]] for c in chunks_data]
            scores = reranker.predict(pairs)
            
            # Sort by reranker score
            scored_chunks = sorted(zip(chunks_data, scores), key=lambda x: x[1], reverse=True)
            final_chunks = [sc[0]["text"] for sc in scored_chunks[:3]]
            logger.info("Reranking completed", top_scores=[round(float(sc[1]), 4) for sc in scored_chunks[:3]])
        except Exception as e:
            logger.error("Cross-Encoder reranking failed, falling back to top 3 from Qdrant", error=str(e))
            final_chunks = [c["text"] for c in chunks_data[:3]]
    else:
        is_degraded_mode = True
        logger.warning("Qdrant search returned no results (database may be offline). Falling back to Structured SQL facts only.")
        final_chunks = []
        
    chunks_text = "\n\n".join(final_chunks)
    
    # 6. Build LLM Prompt
    if is_degraded_mode:
        system_prompt = (
            "You are an expert analyst for this loyalty program. Answer the user's question accurately.\n"
            "NOTE: The semantic vector database is currently offline. You must answer using ONLY the structured database facts and analyst brief provided below.\n\n"
            "=== EXTRACTED FACTS ===\n"
            f"{fields_text}\n\n"
            "=== ANALYST BRIEF ===\n"
            f"{nar_text}\n"
        )
    else:
        system_prompt = (
            "You are an expert analyst for this loyalty program. Answer the user's question accurately.\n"
            "Use ONLY the following context to answer. If you don't know, say so.\n\n"
            "=== EXTRACTED FACTS ===\n"
            f"{fields_text}\n\n"
            "=== ANALYST BRIEF ===\n"
            f"{nar_text}\n\n"
            "=== RELEVANT SOURCE TEXT ===\n"
            f"{chunks_text}\n"
        )
    
    client, model_name = _make_client()
    
    messages = [{"role": "system", "content": system_prompt}]
    for m in history:
        messages.append({"role": m.role, "content": m.content})
        
    def _call_llm():
        res = client.client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.2
        )
        return res.choices[0].message.content
        
    reply_text = await loop.run_in_executor(None, _call_llm)
    
    # 7. Save Assistant Reply
    bot_msg = Message(id=uuid.uuid4(), conversation_id=conv.id, role="assistant", content=reply_text)
    db.add(bot_msg)
    await db.commit()
    
    return ChatResponse(conversation_id=str(conv.id), reply=reply_text)


async def handle_comparison_chat_message(comparison_id: str, body: ChatRequest, db: AsyncSession) -> ChatResponse:
    # 1. Fetch comparison object
    cid = uuid.UUID(comparison_id)
    from backend.models import Comparison, Program
    comp_res = await db.execute(select(Comparison).where(Comparison.id == cid))
    comp = comp_res.scalars().first()
    if not comp:
        raise ValueError("Comparison report not found.")
        
    # 2. Fetch or create conversation
    conv_res = await db.execute(select(Conversation).where(Conversation.program_id == cid))
    conv = conv_res.scalars().first()
    if not conv:
        # We reuse program_id column to store comparison_id for comparisons chat
        conv = Conversation(id=uuid.uuid4(), program_id=cid)
        db.add(conv)
        await db.flush()
        
    # 3. Save User Message
    user_msg = Message(id=uuid.uuid4(), conversation_id=conv.id, role="user", content=body.message)
    db.add(user_msg)
    await db.flush()

    # 4. Fetch all compared programs data for side-by-side facts
    pids = comp.program_ids or []
    programs_context = []
    
    for pid_str in pids:
        pid = uuid.UUID(pid_str)
        prog_res = await db.execute(select(Program).where(Program.id == pid))
        prog = prog_res.scalars().first()
        prog_name = prog.name if prog else "Unknown Program"
        
        fields_res = await db.execute(
            select(ExtractedField).where(
                ExtractedField.program_id == pid,
                ExtractedField.gate_passed == True,
                ExtractedField.is_null == False
            )
        )
        fields = ExtractedField.get_latest_only(fields_res.scalars().all())
        fields_text = "\n".join([f"  - {f.category}.{f.field_name}: {f.field_value}" for f in fields])
        
        programs_context.append(
            f"=== PROGRAM: {prog_name} ===\n"
            f"{fields_text}\n"
        )
        
    programs_facts_block = "\n".join(programs_context)
    
    # 5. Fetch chat history
    msg_res = await db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.desc()).limit(10)
    )
    history = list(reversed(msg_res.scalars().all()))

    # 6. Format comparative synthesis narrative
    analysis = comp.analysis_json or {}
    exec_summary = analysis.get("executive_summary", "")
    matrix_list = analysis.get("matrix", [])
    matrix_text = "\n".join([
        f"- Category: {m.get('category','')}\n  Rankings: {', '.join(m.get('rankings',[]))}\n  Rationale: {m.get('rationale','')}"
        for m in matrix_list
    ])
    recommendations = analysis.get("strategic_recommendations", "")

    system_prompt = (
        "You are an expert loyalty program analyst. Answer the user's question comparing the loyalty programs.\n"
        "Use ONLY the following verified facts, comparative matrix, and strategic overview to answer. If you don't know, say so.\n\n"
        "=== STRATEGIC OVERVIEW ===\n"
        f"Executive Summary: {exec_summary}\n\n"
        f"Strategic Recommendations: {recommendations}\n\n"
        "=== COMPETITIVE MATRIX RANKINGS ===\n"
        f"{matrix_text}\n\n"
        "=== DETAILED SIDE-BY-SIDE PROGRAM FACTS ===\n"
        f"{programs_facts_block}\n"
    )

    client, model_name = _make_client()
    messages = [{"role": "system", "content": system_prompt}]
    for m in history:
        messages.append({"role": m.role, "content": m.content})
        
    loop = asyncio.get_running_loop()
    def _call_llm():
        res = client.client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.2
        )
        return res.choices[0].message.content
        
    reply_text = await loop.run_in_executor(None, _call_llm)
    
    # 8. Save Assistant Reply
    bot_msg = Message(id=uuid.uuid4(), conversation_id=conv.id, role="assistant", content=reply_text)
    db.add(bot_msg)
    await db.commit()
    
    return ChatResponse(conversation_id=str(conv.id), reply=reply_text)

