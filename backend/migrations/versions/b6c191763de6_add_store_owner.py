"""add store owner

Revision ID: b6c191763de6
Revises: a51c9f3e2d84
Create Date: 2026-09-10 16:35:54.104644
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b6c191763de6'
down_revision: Union[str, None] = 'a51c9f3e2d84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'stores',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), index=True)
    )


def downgrade() -> None:
    op.drop_column('stores', 'user_id')
