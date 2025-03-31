"""Create user_activities table

Revision ID: a1b2c3d4e5f6
Revises: 08a6ca3b4ff1
Create Date: 2023-08-02 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '08a6ca3b4ff1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('user_activities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_type', sa.String(), nullable=False),
        sa.Column('details', JSON, nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_activities_id'), 'user_activities', ['id'], unique=False)
    op.create_index(op.f('ix_user_activities_user_id'), 'user_activities', ['user_id'], unique=False)
    op.create_index(op.f('ix_user_activities_username'), 'user_activities', ['username'], unique=False)
    op.create_index(op.f('ix_user_activities_action'), 'user_activities', ['action'], unique=False)
    op.create_index(op.f('ix_user_activities_user_type'), 'user_activities', ['user_type'], unique=False)
    op.create_index(op.f('ix_user_activities_timestamp'), 'user_activities', ['timestamp'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_user_activities_timestamp'), table_name='user_activities')
    op.drop_index(op.f('ix_user_activities_user_type'), table_name='user_activities')
    op.drop_index(op.f('ix_user_activities_action'), table_name='user_activities')
    op.drop_index(op.f('ix_user_activities_username'), table_name='user_activities')
    op.drop_index(op.f('ix_user_activities_user_id'), table_name='user_activities')
    op.drop_index(op.f('ix_user_activities_id'), table_name='user_activities')
    op.drop_table('user_activities') 