"""create_notifications_table

Revision ID: 8f27g6s2a77h
Revises: a1b2c3d4e5f6
Create Date: 2023-09-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8f27g6s2a77h'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('link', sa.String(), nullable=False),
        sa.Column('notification_type', sa.String(), nullable=False),
        sa.Column('read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('event_id', sa.Integer(), nullable=True),
        sa.Column('comment_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ),
        sa.ForeignKeyConstraint(['comment_id'], ['event_comments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index on user_id for fast notification lookup
    op.create_index(
        'idx_notifications_user_id', 'notifications', ['user_id']
    )
    
    # Create index on read status for unread count queries
    op.create_index(
        'idx_notifications_read', 'notifications', ['read']
    )


def downgrade():
    # Drop notifications table
    op.drop_index('idx_notifications_read', 'notifications')
    op.drop_index('idx_notifications_user_id', 'notifications')
    op.drop_table('notifications')