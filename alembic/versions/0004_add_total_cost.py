"""Add total_cost column to programs

Revision ID: 0004_add_total_cost
Revises: 0003_citation_offsets
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_add_total_cost"
down_revision = "0003_citation_offsets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add total_cost column to programs table.

    Tracks accumulated LLM API cost in USD per program.
    """
    op.execute(
        "ALTER TABLE programs ADD COLUMN IF NOT EXISTS total_cost NUMERIC(8, 4) NOT NULL DEFAULT 0.0"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE programs DROP COLUMN IF EXISTS total_cost")
