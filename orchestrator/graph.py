"""LangGraph orchestrator — Phase 0 stub.

All nodes are pass-through. This file exists only to prove that:
  1. LangGraph imports and compiles correctly.
  2. The graph structure (retrieve → extract → verify → narrate) is wired.

Real logic is added in Phase 1+.
"""
from typing import TypedDict, Any
from langgraph.graph import StateGraph, END


class PipelineState(TypedDict):
    """Shared state passed between nodes."""
    program_id: str
    program_name: str
    sources: list[Any]
    extracted_fields: dict[str, Any]
    narrative: str


# --------------------------------------------------------------------------- #
# Stub nodes — each returns state unchanged
# --------------------------------------------------------------------------- #

def retrieve_node(state: PipelineState) -> PipelineState:
    """Phase 0 stub: will call Tavily + Firecrawl in Phase 2."""
    return state


def extract_node(state: PipelineState) -> PipelineState:
    """Phase 0 stub: will call Instructor+Claude in Phase 3."""
    return state


def verify_node(state: PipelineState) -> PipelineState:
    """Phase 0 stub: will run citation gate + confidence formula in Phase 4."""
    return state


def narrate_node(state: PipelineState) -> PipelineState:
    """Phase 0 stub: will produce 500-1000 word brief in Phase 5."""
    return state


# --------------------------------------------------------------------------- #
# Graph assembly
# --------------------------------------------------------------------------- #

def build_graph() -> Any:
    """Build and compile the LangGraph pipeline."""
    builder = StateGraph(PipelineState)

    builder.add_node("retrieve", retrieve_node)
    builder.add_node("extract", extract_node)
    builder.add_node("verify", verify_node)
    builder.add_node("narrate", narrate_node)

    builder.set_entry_point("retrieve")
    builder.add_edge("retrieve", "extract")
    builder.add_edge("extract", "verify")
    builder.add_edge("verify", "narrate")
    builder.add_edge("narrate", END)

    return builder.compile()


# Module-level compiled graph — import this in tests
graph = build_graph()
