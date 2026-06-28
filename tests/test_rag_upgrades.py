import pytest
import uuid
from unittest.mock import MagicMock, patch, AsyncMock
from qdrant_client.http import models

from backend.chat import _sync_search_qdrant
from orchestrator.nodes import _call_llm_judge, verify_node
from orchestrator.state import PipelineState
from backend.gate import GateResult

def test_metadata_filtering_passed_to_qdrant():
    """Verify that when a source_type is specified, Qdrant FieldCondition is built."""
    mock_client = MagicMock()
    # Mock return list of points
    mock_client.query_points.return_value.points = []
    
    with patch("backend.chat.get_qdrant_client", return_value=mock_client), \
         patch("backend.chat.embed_texts", return_value=[[0.1]*3072]):
             
        _sync_search_qdrant(
            program_id=str(uuid.uuid4()),
            query="test query",
            all_chunks=["some chunks", "more chunks"],
            limit=5,
            source_type="tnc"
        )
        
        # Verify query_points was called with filter containing source_type == tnc
        assert mock_client.query_points.called
        call_kwargs = mock_client.query_points.call_args[1]
        query_filter = call_kwargs.get("query_filter")
        assert query_filter is not None
        
        # Should have program_id and source_type match conditions
        conditions = query_filter.must
        assert len(conditions) == 2
        assert any(c.key == "source_type" and c.match.value == "tnc" for c in conditions)

def test_hybrid_search_rrf_prefetch():
    """Verify that hybrid search generates prefetch for dense and sparse vectors fused with RRF."""
    mock_client = MagicMock()
    mock_client.query_points.return_value.points = []
    
    with patch("backend.chat.get_qdrant_client", return_value=mock_client), \
         patch("backend.chat.embed_texts", return_value=[[0.1]*3072]):
             
        _sync_search_qdrant(
            program_id=str(uuid.uuid4()),
            query="credit card benefits",
            all_chunks=["gold card tier benefits", "rewards cash back lounge access"],
            limit=10,
            source_type=None
        )
        
        assert mock_client.query_points.called
        call_kwargs = mock_client.query_points.call_args[1]
        
        # Prefetch list should contain dense prefetch and sparse prefetch
        prefetch = call_kwargs.get("prefetch")
        assert prefetch is not None
        assert len(prefetch) == 2
        
        # Dense prefetch
        assert isinstance(prefetch[0].query, list)
        
        # Sparse prefetch
        assert isinstance(prefetch[1].query, models.SparseVector)
        assert prefetch[1].using == "sparse-text"
        
        # Fusion should be RRF
        query = call_kwargs.get("query")
        assert isinstance(query, models.FusionQuery)
        assert query.fusion == models.Fusion.RRF

def test_semantic_llm_judge_verbatim_override():
    """Verify that _call_llm_judge parses LLM 'YES' output correctly."""
    mock_instructor = MagicMock()
    mock_instructor.client.chat.completions.create.return_value.choices[0].message.content = "  YES  "
    
    with patch("backend.extractor._make_client", return_value=(mock_instructor, "stub-model")):
        is_match = _call_llm_judge(
            field_name="tier_system.tier_count",
            value="3",
            quote="Three membership levels are offered.",
            context="The program offers three membership levels: Silver, Gold, Platinum."
        )
        assert is_match is True

@pytest.mark.asyncio
async def test_llm_judge_gate_invoked_on_borderline_match():
    """Verify that verify_node triggers LLM judge when fuzzy score is in [0.70, 0.94]."""
    program_id = str(uuid.uuid4())
    
    # Fuzzy match returns 0.85 (borderline failure)
    mock_gate_res = GateResult(
        passed=False,
        match_score=0.85,
        matched_value=None,
        rejection_reason="low score"
    )
    
    state = {
        "program_id": program_id,
        "program_name": "Test Program",
        "extracted_schema": {
            "program_basics": {
                "mobile_app_available": {"value": "TRUE", "evidence_quote": "app is ready", "source_url": "https://test.com"}
            }
        },
        "source_dicts": [
            {"id": str(uuid.uuid4()), "url": "https://test.com", "raw_content": "app is ready and available now", "source_type": "tnc"}
        ]
    }
    
    # Mock LLM judge returning YES (True)
    with patch("orchestrator.nodes.gate_verify", return_value=mock_gate_res), \
         patch("orchestrator.nodes._call_llm_judge", return_value=True) as mock_judge, \
         patch("orchestrator.nodes.AsyncSessionLocal") as mock_session_cls, \
         patch("orchestrator.nodes.emit_event") as mock_emit:
             
        # Mock DB sessions
        session = AsyncMock()
        mock_session_cls.return_value.__aenter__.return_value = session
        
        # Run verify_node
        res = await verify_node(state)
        
        # Verify LLM judge was called
        assert mock_judge.called
        # Verify gate results were overridden to pass because judge returned True
        assert mock_gate_res.passed is True
        assert mock_gate_res.matched_value == "TRUE"
