"""create_user_preferences_table

Revision ID: a427t6s9a79e
Revises: 8f27g6s2a77h
Create Date: 2023-10-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a427t6s9a79e'
down_revision = '8f27g6s2a77h'
branch_labels = None
depends_on = None


def upgrade():
    # Create user_preferences table
    op.create_table(
        'user_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('email_notifications', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    
    # Create index on user_id for fast lookup
    op.create_index(
        'idx_user_preferences_user_id', 'user_preferences', ['user_id']
    )


def downgrade():
    # Drop user_preferences table
    op.drop_index('idx_user_preferences_user_id', 'user_preferences')
    op.drop_table('user_preferences') 