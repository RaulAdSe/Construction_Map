"""add file_type to events

Revision ID: add_file_type_column
Revises: 8f27g6s2a77h
Create Date: 2023-04-05

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_file_type_column'
down_revision = '8f27g6s2a77h'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('events', sa.Column('file_type', sa.String(), nullable=True))


def downgrade():
    op.drop_column('events', 'file_type') 