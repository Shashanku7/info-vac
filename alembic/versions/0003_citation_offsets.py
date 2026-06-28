"""Add citation_start and citation_end columns to extracted_fields

Revision ID: 0003_citation_offsets
Revises: 0002_add_raw_html
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_citation_offsets"
down_revision = "0002_add_raw_html"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add citation_start and citation_end columns to extracted_fields.

    Used to store character indices of evidence quotes to support UI highlighting.
    """
    op.execute(
        "ALTER TABLE extracted_fields ADD COLUMN IF NOT EXISTS citation_start INTEGER"
    )
    op.execute(
        "ALTER TABLE extracted_fields ADD COLUMN IF NOT EXISTS citation_end INTEGER"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE extracted_fields DROP COLUMN IF EXISTS citation_start")
    op.execute("ALTER TABLE extracted_fields DROP COLUMN IF EXISTS citation_end")
