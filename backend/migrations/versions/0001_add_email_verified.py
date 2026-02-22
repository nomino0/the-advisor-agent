"""Add email_verified column to users table

Revision ID: 0001_add_email_verified
Revises: 
Create Date: 2026-02-22
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_add_email_verified'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add a boolean column `email_verified` default False to users table
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), server_default=sa.text('false'), nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'email_verified')
