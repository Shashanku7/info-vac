"""Shared pytest fixtures for InfoVac tests.

Key design decision: NullPool.
asyncpg connection objects are bound to the event loop that created them.
pytest-asyncio creates a new event loop per test function. Using a connection
pool means the second test gets a connection from the first test's loop → crash.
NullPool creates a fresh connection per operation and closes it immediately —
no pool, no cross-loop contamination. Slightly slower (new TCP handshake per
test) but completely reliable.
"""
import os
import uuid

import pytest_asyncio
from dotenv import load_dotenv
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from backend.models import Program

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://infovac:infovac_dev@localhost:5432/infovac",
)


@pytest_asyncio.fixture()
async def db_session():
    """Fresh NullPool engine + session per test — no cross-loop asyncpg issues."""
    engine = create_async_engine(DATABASE_URL, echo=False, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture()
async def temp_program(db_session: AsyncSession):
    """Insert a Program row; delete it (+ cascaded sources) after each test."""
    prog = Program(name=f"Test Program {uuid.uuid4().hex[:8]}")
    db_session.add(prog)
    await db_session.commit()
    await db_session.refresh(prog)
    prog_id = prog.id

    yield prog

    # Teardown: reload by PK (state may be expired after retriever commits)
    loaded = await db_session.get(Program, prog_id)
    if loaded:
        await db_session.delete(loaded)
        await db_session.commit()
