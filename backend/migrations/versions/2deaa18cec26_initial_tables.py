"""initial tables

Revision ID: 2deaa18cec26
Revises: 
Create Date: 2026-09-10 10:53:40.015937
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '2deaa18cec26'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('full_name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True, index=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
    )

    op.create_table(
        'stores',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('shop_domain', sa.String(), unique=True, index=True),
        sa.Column('access_token', sa.String()),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('stores')
    op.drop_table('users')
