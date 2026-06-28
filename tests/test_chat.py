import uuid
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from backend.chat import ChatRequest, handle_chat_message

@pytest.mark.asyncio
async def test_handle_chat_message_creates_conversation():
    prog_id = str(uuid.uuid4())
    mock_db = AsyncMock()
    
    # Mock no existing conversation
    mock_conv_res = MagicMock()
    mock_conv_res.scalars().first.return_value = None
    
    # Mock empty fields/narratives/history
    mock_empty_res = MagicMock()
    mock_empty_res.scalars().all.return_value = []
    mock_empty_res.scalars().first.return_value = None
    
    # db.execute sequence: Conv -> Fields -> Narrative -> History -> Sources
    mock_db.execute.side_effect = [
        mock_conv_res,
        mock_empty_res,
        mock_empty_res,
        mock_empty_res,
        mock_empty_res
    ]
    
    mock_client = MagicMock()
    mock_client.client.chat.completions.create.return_value.choices[0].message.content = "Mock Reply"
    
    # Mock CrossEncoder to prevent downloading/loading 300MB weights during fast test runs
    mock_cross_encoder = MagicMock()
    mock_cross_encoder.predict.return_value = [1.0]
    
    with patch("backend.chat._sync_search_qdrant", return_value=[{"text": "Mock Chunk"}]), \
         patch("backend.chat._make_client", return_value=(mock_client, "stub-model")), \
         patch("backend.chat.asyncio.get_running_loop") as mock_loop, \
         patch("sentence_transformers.CrossEncoder", return_value=mock_cross_encoder):
              
        # Mock run_in_executor for _sync_search_qdrant and _call_llm
        async def mock_run_in_executor(executor, func, *args):
            # If args are passed, it's the search function (program_id, query, chunks, limit, source_type)
            if len(args) > 1:
                return [{"text": "Mock Chunk"}]
            else:
                return "Mock Reply"
        mock_loop.return_value.run_in_executor = mock_run_in_executor
        
        req = ChatRequest(message="Hello?")
        res = await handle_chat_message(prog_id, req, mock_db)
        
        assert res.reply == "Mock Reply"
        # Verify conversation creation was added to db
        assert mock_db.add.call_count >= 2 # Conversation, User Msg, Bot Msg
