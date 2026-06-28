"""Support multi-compare and append-only database layout

Revision ID: 0005_support_multi_compare
Revises: 0004_add_total_cost
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_support_multi_compare"
down_revision = "0004_add_total_cost"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Drop UNIQUE constraint from extracted_fields
    op.execute(
        "ALTER TABLE extracted_fields DROP CONSTRAINT IF EXISTS extracted_fields_program_id_field_name_key"
    )
    
    # 2. Make program_a_id and program_b_id nullable in comparisons
    op.execute(
        "ALTER TABLE comparisons ALTER COLUMN program_a_id DROP NOT NULL"
    )
    op.execute(
        "ALTER TABLE comparisons ALTER COLUMN program_b_id DROP NOT NULL"
    )
    
    # 3. Add program_ids column to comparisons
    op.execute(
        "ALTER TABLE comparisons ADD COLUMN IF NOT EXISTS program_ids JSONB NULL"
    )


def downgrade() -> None:
    # 1. Re-add UNIQUE constraint to extracted_fields
    # (Note: this might fail if duplicate fields were added during upgrade, but that is expected downgrade behavior)
    op.execute(
        "ALTER TABLE extracted_fields ADD CONSTRAINT extracted_fields_program_id_field_name_key UNIQUE (program_id, field_name)"
    )
    
    # 2. Make program_a_id and program_b_id non-nullable again
    op.execute(
        "ALTER TABLE comparisons ALTER COLUMN program_a_id SET NOT NULL"
    )
    op.execute(
        "ALTER TABLE comparisons ALTER COLUMN program_b_id SET NOT NULL"
    )
    
    # 3. Drop program_ids column from comparisons
    op.execute(
        "ALTER TABLE comparisons DROP COLUMN IF EXISTS program_ids"
    )
