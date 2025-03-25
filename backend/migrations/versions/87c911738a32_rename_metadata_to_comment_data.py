"""Rename metadata to comment_data

Revision ID: 87c911738a32
Revises: b131afd18cba
Create Date: 2025-03-25 13:03:23.357707

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '87c911738a32'
down_revision = 'b131afd18cba'
branch_labels = None
depends_on = None


def upgrade():
    # Rename metadata column to comment_data
    op.alter_column('event_comments', 'metadata', new_column_name='comment_data')


def downgrade():
    # Rename comment_data column back to metadata
    op.alter_column('event_comments', 'comment_data', new_column_name='metadata') 