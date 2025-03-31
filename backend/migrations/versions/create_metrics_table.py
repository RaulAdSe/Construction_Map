"""create metrics table

Revision ID: 08a6ca3b4ff1
Revises: 
Create Date: 2023-04-18 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = '08a6ca3b4ff1'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('metrics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('tags', JSON(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_metrics_id'), 'metrics', ['id'], unique=False)
    op.create_index(op.f('ix_metrics_name'), 'metrics', ['name'], unique=False)
    op.create_index(op.f('ix_metrics_timestamp'), 'metrics', ['timestamp'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_metrics_timestamp'), table_name='metrics')
    op.drop_index(op.f('ix_metrics_name'), table_name='metrics')
    op.drop_index(op.f('ix_metrics_id'), table_name='metrics')
    op.drop_table('metrics') 