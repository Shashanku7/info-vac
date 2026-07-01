"""Add trace_url column to programs

Revision ID: 0006_add_trace_url
Revises: 0005_support_multi_compare
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa


revision = "0006_add_trace_url"
down_revision = "0005_support_multi_compare"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE programs ADD COLUMN IF NOT EXISTS trace_url TEXT NULL"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE programs DROP COLUMN IF EXISTS trace_url"
    )
