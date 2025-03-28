"""add_role_and_timestamps_to_project_users

Revision ID: c6497e7bd5aa
Revises: 87c911738a32
Create Date: 2025-03-28 16:42:10.895963

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c6497e7bd5aa'
down_revision = '87c911738a32'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('project_users', sa.Column('role', sa.String(), nullable=True))
    op.add_column('project_users', sa.Column('joined_at', sa.DateTime(), nullable=True))
    op.add_column('project_users', sa.Column('last_accessed_at', sa.DateTime(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('project_users', 'last_accessed_at')
    op.drop_column('project_users', 'joined_at')
    op.drop_column('project_users', 'role')
    # ### end Alembic commands ### 