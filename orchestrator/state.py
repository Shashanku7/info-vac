"""Pipeline state definition and field iteration helpers."""
from __future__ import annotations
from typing import Optional, TypedDict


class PipelineState(TypedDict):
    """Shared state flowing through the LangGraph pipeline.

    All values must be JSON-serialisable (no ORM objects).
    Source ORM objects are converted to dicts in retrieve_node before
    being stored here.
    """
    program_id: str            # UUID string
    program_name: str
    source_dicts: list[dict]   # {id, url, source_type, raw_content, fetch_method, fetched_at}
    extracted_schema: Optional[dict]  # ExtractedSchema.model_dump()
    error: Optional[str]
    retry_count: int


def iter_fields(schema_dict: dict) -> list[tuple[str, str, dict]]:
    """Yield (category_key, field_name, ev_dict) for every field in the schema.

    Args:
        schema_dict: ExtractedSchema.model_dump() output

    Returns:
        List of (category_snake_key, field_name, ExtractedValue dict)
    """
    rows: list[tuple[str, str, dict]] = []
    for cat_key, cat_dict in schema_dict.items():
        if not isinstance(cat_dict, dict):
            continue
        for field_name, ev_dict in cat_dict.items():
            if isinstance(ev_dict, dict):
                rows.append((cat_key, field_name, ev_dict))
    return rows
