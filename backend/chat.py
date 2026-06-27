import uuid
import asyncio
import structlog
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models import Conversation, Message, Program, ExtractedField, Narrative
from backend.extractor import _make_client
from backend.qdrant_client import get_qdrant_client
from backend.embeddings import embed_texts

logger = structlog.get_logger(__name__)

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    conversation_id: str
    reply: str

def _sync_search_qdrant(program_id: str, query: str, limit: int = 5) -> list[str]:
    """Embed the query and search Qdrant synchronously."""
    query_vector = embed_texts([query])[0]
    client = get_qdrant_client()
    
    # Search with filter for program_id
    from qdrant_client.http import models
    response = client.query_points(
        collection_name="sources",
        query=query_vector,
        query_filter=models.Filter(
            must=[models.FieldCondition(key="program_id", match=models.MatchValue(value=program_id))]
        ),
        limit=limit
    )
    return [hit.payload.get("text", "") for hit in response.points]

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
    fields = fields_res.scalars().all()
    fields_text = "\n".join([f"- {f.category}.{f.field_name}: {f.field_value}" for f in fields])
    
    nar_res = await db.execute(select(Narrative).where(Narrative.program_id == pid).order_by(Narrative.created_at.desc()))
    narrative = nar_res.scalars().first()
    nar_text = narrative.narrative_text if narrative else "No narrative available."
    
    msg_res = await db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.desc()).limit(10)
    )
    history = list(reversed(msg_res.scalars().all()))
    
    # 4. Fetch Context from Qdrant
    loop = asyncio.get_running_loop()
    chunks = await loop.run_in_executor(None, _sync_search_qdrant, program_id, body.message)
    chunks_text = "\n\n".join(chunks)
    
    # 5. Build LLM Prompt
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
    
    # Since instructor wraps OpenAI client, we can bypass the pydantic response if we want,
    # or we can ask for a simple BaseModel. Let's just use the raw client.
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
    
    # 6. Save Assistant Reply
    bot_msg = Message(id=uuid.uuid4(), conversation_id=conv.id, role="assistant", content=reply_text)
    db.add(bot_msg)
    await db.commit()
    
    return ChatResponse(conversation_id=str(conv.id), reply=reply_text)
