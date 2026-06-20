"""Manual spot-check script for the human checkpoint in Phase 1.

Usage:
    python scripts/run_retriever.py "Starbucks Rewards"
    python scripts/run_retriever.py "Delta SkyMiles"

Prints a table of discovered sources for human review.
The automated pytest tests can't catch "10 sources, all irrelevant" —
this is what the human verifies.
"""
import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from backend.models import Program
from backend.retriever import discover_sources

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://infovac:infovac_dev@localhost:5432/infovac",
)


async def main(program_name: str) -> None:
    engine = create_async_engine(DATABASE_URL, echo=False, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with factory() as session:
        # Create a throwaway program row
        prog = Program(name=program_name)
        session.add(prog)
        await session.commit()
        await session.refresh(prog)

        print(f"\nResearching: {program_name!r}")
        print(f"Program ID : {prog.id}")
        print("-" * 80)

        sources = await discover_sources(
            program_name=program_name,
            program_id=prog.id,
            db=session,
        )

        if not sources:
            print("[!] No sources found. Check API keys and try a different program name.")
        else:
            print(f"\n{'TYPE':<14} {'METHOD':<16} {'CONTENT (chars)':<16} URL")
            print("-" * 80)
            for s in sorted(sources, key=lambda x: x.source_type):
                content_len = len(s.raw_content or "")
                print(f"{s.source_type:<14} {s.fetch_method:<16} {content_len:<16} {s.url}")

            print(f"\nTotal sources : {len(sources)}")
            print(f"Distinct types: {sorted({s.source_type for s in sources})}")
            print(f"\n[Human checkpoint] Open 2-3 URLs above in your browser.")
            print("Are they actually about", repr(program_name), "?")

        await engine.dispose()


if __name__ == "__main__":
    name = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Starbucks Rewards"
    asyncio.run(main(name))
