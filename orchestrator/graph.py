"""LangGraph graph wiring and public run_pipeline() entry point.

This file is intentionally thin — all logic lives in nodes.py, events.py,
and state.py. Graph.py only wires them together.
"""
from __future__ import annotations

import structlog
from langgraph.graph import StateGraph, END

from orchestrator.events import emit_event, set_status
from orchestrator.nodes import retrieve_node, embed_node, extract_node, verify_node, narrate_node
from orchestrator.state import PipelineState

log = structlog.get_logger(__name__)


def build_graph():
    """Compile the LangGraph pipeline graph."""
    builder = StateGraph(PipelineState)
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("embed", embed_node)
    builder.add_node("extract", extract_node)
    builder.add_node("verify", verify_node)
    builder.add_node("narrate", narrate_node)
    builder.set_entry_point("retrieve")
    builder.add_edge("retrieve", "embed")
    builder.add_edge("embed", "extract")
    builder.add_edge("extract", "verify")
    builder.add_edge("verify", "narrate")
    builder.add_edge("narrate", END)
    return builder.compile()


# Module-level compiled graph — importable for tests
graph = build_graph()


async def run_pipeline(program_id: str, program_name: str) -> None:
    """Public entry point called by FastAPI background task.

    Runs the full LangGraph pipeline for one program.
    Unhandled exceptions are caught here so the background task never crashes
    the server — they are logged and written to programs.error_message.
    """
    initial_state: PipelineState = {
        "program_id": program_id,
        "program_name": program_name,
        "source_dicts": [],
        "extracted_schema": None,
        "error": None,
        "retry_count": 0,
    }
    try:
        await graph.ainvoke(initial_state)
    except Exception as exc:
        err = str(exc)[:400]
        log.error("pipeline_unhandled_error", program_id=program_id, error=err)
        await set_status(program_id, "failed", err)
        await emit_event(program_id, "failed", 0.0, f"Unhandled error: {err}")
