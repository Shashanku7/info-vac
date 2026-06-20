"""FastAPI application — Phase 0 skeleton.

Exposes only:
    POST /api/programs  →  inserts a row, returns UUID + name + status
"""
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid

from backend.db import get_db
from backend.models import Program

app = FastAPI(
    title="InfoVac API",
    version="0.1.0",
    description="Autonomous Competitive Intelligence Agent — skeleton",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #

class ProgramCreate(BaseModel):
    name: str


class ProgramResponse(BaseModel):
    id: uuid.UUID
    name: str
    status: str

    model_config = {"from_attributes": True}


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/programs", response_model=ProgramResponse, status_code=200)
async def create_program(body: ProgramCreate, db: AsyncSession = Depends(get_db)):
    """Insert a program row and return its UUID.

    Phase 0: no background job is started — this is purely a DB insert.
    """
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="name must not be empty")

    program = Program(name=body.name.strip())
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program
