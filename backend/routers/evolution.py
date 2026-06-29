"""Evolution Router.

Handles analyzing changes in loyalty programs over time (oldest run vs. newest run).
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db import get_db
from backend.models import Program, ExtractedField
from backend.llm_client import _make_client

router = APIRouter(prefix="/api/programs", tags=["evolution"])


class ChangelogItem(BaseModel):
    category: str = Field(description="Category of the field (e.g., 'earn_mechanics')")
    field_name: str = Field(description="Name of the field")
    old_value: Optional[str] = Field(description="Old value")
    new_value: Optional[str] = Field(description="New value")
    change_type: str = Field(description="Type of change: 'upgraded', 'devalued', 'altered', or 'none'")
    analysis: str = Field(description="Factual analysis of what changed and the strategic impact")


class EvolutionOutput(BaseModel):
    executive_summary: str = Field(description="High-level analysis of how the loyalty program evolved over time.")
    changelog: list[ChangelogItem] = Field(description="List of specific changes between oldest and newest runs.")


@router.get("/{program_id}/evolution")
async def get_program_evolution(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Analyze changes in program fields over time (oldest run vs. newest run)."""
    program = await db.get(Program, program_id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")

    fields_res = await db.execute(
        select(ExtractedField).where(
            ExtractedField.program_id == program_id,
            ExtractedField.gate_passed == True
        ).order_by(ExtractedField.created_at.asc())
    )
    all_fields = list(fields_res.scalars().all())
    
    if not all_fields:
        raise HTTPException(status_code=404, detail="No extraction data found for this program.")

    by_field = {}
    for f in all_fields:
        by_field.setdefault(f.field_name, []).append(f)

    diff_lines = []
    for field_name, run_list in by_field.items():
        oldest = run_list[0]
        newest = run_list[-1]
        
        old_val = str(oldest.field_value) if oldest.field_value is not None else "null"
        new_val = str(newest.field_value) if newest.field_value is not None else "null"
        
        if oldest.id != newest.id:
            diff_lines.append(
                f"- Category: {oldest.category}\n"
                f"  Field: {field_name}\n"
                f"  Old Value (extracted {oldest.created_at.isoformat()}): {old_val}\n"
                f"  New Value (extracted {newest.created_at.isoformat()}): {new_val}\n"
            )
            
    if not diff_lines:
        return {
            "executive_summary": "No changes detected. The program has only been run once, or no fields have evolved.",
            "changelog": []
        }

    grounded_context = "\n".join(diff_lines)
    prompt = (
        "You are a loyalty program analyst. Your task is to write a structured evolution changelog.\n"
        "Here is the diff comparing the oldest extraction run against the newest run for this program:\n\n"
        f"{grounded_context}\n\n"
        "Analyze these differences and output a structured changelog specifying if they represent upgrades, "
        "devaluations, alterations, or no change, and write a professional strategic analysis for each."
    )
    
    client, model_name = _make_client()
    kwargs = {
        "response_model": EvolutionOutput,
        "messages": [
            {"role": "system", "content": "You are a competitive intelligence analyst. Write a strategic evolution changelog."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.0,
    }
    if model_name and not model_name.startswith("gemini"):
        kwargs["model"] = model_name

    loop = asyncio.get_running_loop()
    def _call_llm():
        return client.chat.completions.create(**kwargs)

    res = await loop.run_in_executor(None, _call_llm)
    return res.model_dump()
