"""Add raw_html column to sources for HTML table preservation

Revision ID: 0002_add_raw_html
Revises: f488ae1af2aa
Create Date: 2026-06-28
"""
from alembic import op

revision = "0002_add_raw_html"
down_revision = "f488ae1af2aa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add raw_html TEXT column to sources table.

    Stores up to 80K chars of raw HTML fetched by Firecrawl alongside
    the existing markdown raw_content. Used by the extractor for TierSystem
    category to read HTML tables that markdown rendering destroys.
    Column is nullable -- only populated for Firecrawl-fetched sources.
    """
    op.execute(
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS raw_html TEXT"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS raw_html")
