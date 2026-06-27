"""Add Conversation and Message models

Revision ID: f488ae1af2aa
Revises: 0001
Create Date: 2026-06-27 13:28:12.597253

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f488ae1af2aa'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old conversations table if it exists to replace with new schema
    op.drop_table('conversations')
    
    op.create_table('conversations',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('program_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('messages',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('conversation_id', sa.UUID(), nullable=False),
    sa.Column('role', sa.String(length=50), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('messages')
    op.drop_table('conversations')
    # ### end Alembic commands ###
