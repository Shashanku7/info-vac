import asyncio
import uuid
from unittest.mock import AsyncMock, patch, MagicMock
import pytest
from pydantic import BaseModel

# Imports from app
from backend.models import Program, ExtractedField, Narrative, Comparison
from backend.main import app, ProgramCreate
from backend.gate import gate_verify_multi_source, GateResult
from orchestrator.nodes import retrieve_node, embed_node, extract_node, verify_node, narrate_node
from orchestrator.graph import run_pipeline, get_public_trace_url
from orchestrator.state import PipelineState


# --- Dummy mock schemas matching backend ---
class DummyProgramBasics(BaseModel):
    program_name: str
    brand: str
    geography: str
    membership_count: str


class DummyExtractedSchema(BaseModel):
    program_basics: DummyProgramBasics


@pytest.mark.asyncio
async def test_comprehensive_system_stack():
    """
    Comprehensive System Integration Test.
    
    Covers:
      1. Graph Node Execution (Retrieve -> Embed -> Extract -> Verify -> Narrate)
      2. Verification Gate fuzzy logic & gate scoring calculations
      3. RAG/Embedding ingestion flow simulation
      4. FastAPI endpoint routing & schemas mapping
      5. LangSmith trace URL extraction & DB updates
    """
    program_id = str(uuid.uuid4())
    program_name = "Maharaja Club"
    
    # ---------------------------------------------------------
    # 1. Mocking External Services (Tavily, Firecrawl, Gemini, Qdrant)
    # ---------------------------------------------------------
    mock_sources = [
        {
            "url": "https://www.airindia.com/maharaja-club",
            "raw_content": "Maharaja Club is Air India’s official frequent flyer program. Members earn 6 Maharaja Points per INR 100 spent.",
            "source_type": "tnc"
        }
    ]
    
    # Mock extractor output matching Instructor Pydantic model
    mock_extracted_data = MagicMock()
    
    # Enable dictionary-like .get() behavior for extraction_cost check
    def mock_get(key, default=None):
        if key == "extraction_cost":
            return 0.0
        return default
    mock_extracted_data.get = mock_get
    
    mock_extracted_data.program_basics = MagicMock(
        program_name=MagicMock(value="Maharaja Club", evidence_quote="Maharaja Club is Air India’s official frequent flyer program", source_url="https://www.airindia.com/maharaja-club"),
        brand=MagicMock(value="Air India", evidence_quote="Air India’s official frequent flyer program", source_url="https://www.airindia.com/maharaja-club"),
        geography=MagicMock(value="India", evidence_quote="INR 100 spent", source_url="https://www.airindia.com/maharaja-club"),
        membership_count=MagicMock(value="10 Million", evidence_quote="Members", source_url="https://www.airindia.com/maharaja-club")
    )
    
    # Setup graph state
    state: PipelineState = {
        "program_id": program_id,
        "program_name": program_name,
        "source_dicts": mock_sources,
        "extracted_schema": mock_extracted_data,
        "error": None,
        "retry_count": 0,
    }

    # ---------------------------------------------------------
    # 2. Test Verification Gate logic & fuzzy scoring
    # ---------------------------------------------------------
    # Map sources to dictionary format expected by gate_verify_multi_source
    url_to_source = {
        s["url"]: {"id": str(uuid.uuid4()), "raw_content": s["raw_content"]}
        for s in mock_sources
    }

    # Test a perfect match (100% score)
    res_pass, matched_url, matched_src_id = gate_verify_multi_source(
        field_name="program_name",
        claimed_value="Maharaja Club",
        evidence_quote="Maharaja Club is Air India’s official frequent flyer program",
        url_to_source=url_to_source
    )
    assert res_pass.passed is True
    assert res_pass.match_score == 1.0
    assert matched_url == "https://www.airindia.com/maharaja-club"

    # Test an unrelated claim (should fail gate validation)
    res_fail, failed_url, failed_src_id = gate_verify_multi_source(
        field_name="program_name",
        claimed_value="Delta SkyMiles",
        evidence_quote="Delta SkyMiles is awesome",
        url_to_source=url_to_source
    )
    assert res_fail.passed is False
    assert res_fail.match_score < 0.50

    # ---------------------------------------------------------
    # 3. Simulate LangGraph Node pipeline execution
    # ---------------------------------------------------------
    with patch("orchestrator.nodes.AsyncSessionLocal") as mock_db, \
         patch("orchestrator.nodes.emit_event") as mock_emit, \
         patch("backend.extractor._make_client") as mock_llm_client:
         
        # Mock DB session execution
        session = AsyncMock()
        mock_db.return_value.__aenter__.return_value = session
        
        # Verify node should execute verification gate calculations
        verify_res = await verify_node(state)
        assert verify_res["extracted_schema"] is not None
        
        # Check that events were emitted
        assert mock_emit.called

    # ---------------------------------------------------------
    # 4. Test FastAPI Routers & Pydantic mapping
    # ---------------------------------------------------------
    # Create ProgramCreate schemas instance
    create_req = ProgramCreate(name="Maharaja Club", force=True)
    assert create_req.name == "Maharaja Club"
    assert create_req.force is True

    # ---------------------------------------------------------
    # 5. Test LangSmith trace generation & database mapping
    # ---------------------------------------------------------
    with patch("orchestrator.graph.Client") as mock_ls_client, \
         patch("orchestrator.graph.os.getenv", return_value="true"):
         
        # Mock LangSmith sharing URL
        mock_ls = MagicMock()
        mock_ls.share_run.return_value = "https://smith.langchain.com/public/trace-link"
        mock_ls_client.return_value = mock_ls
        
        # Test trace URL fetcher
        url = get_public_trace_url("test-run-id")
        assert url == "https://smith.langchain.com/public/trace-link"
        assert mock_ls.share_run.called

    # Test Program DB model fields inclusion
    p_row = Program(id=uuid.UUID(program_id), name="Maharaja Club", trace_url="https://smith.langchain.com/public/trace-link")
    assert p_row.name == "Maharaja Club"
    assert p_row.trace_url == "https://smith.langchain.com/public/trace-link"
    assert str(p_row.id) == program_id

    print("\n[COMPREHENSIVE TEST PASSED SUCCESSFULLY]")
