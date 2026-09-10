"""add automation, notifications, and store/product settings

Revision ID: a51c9f3e2d84
Revises: e0b1417e1499
Create Date: 2026-09-10 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a51c9f3e2d84'
down_revision: Union[str, None] = 'e0b1417e1499'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'automation_rules',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id'), index=True),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('rule_type', sa.String(length=50), nullable=False),
        sa.Column('config', sa.JSON(), default=dict),
        sa.Column('enabled', sa.Boolean(), default=True),
        sa.Column('last_run_at', sa.DateTime()),
        sa.Column('last_status', sa.String(length=20)),
        sa.Column('last_count', sa.Integer()),
        sa.Column('last_error', sa.Text()),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now()),
    )

    op.create_table(
        'automation_runs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('rule_id', sa.Integer(), sa.ForeignKey('automation_rules.id'), index=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('summary', sa.String(length=255)),
        sa.Column('error', sa.Text()),
        sa.Column('ran_at', sa.DateTime(), default=sa.func.now(), index=True),
    )

    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id'), index=True),
        sa.Column('type', sa.String(length=50), index=True),
        sa.Column('severity', sa.String(length=20), default='info'),
        sa.Column('title', sa.String(length=255)),
        sa.Column('message', sa.Text()),
        sa.Column('payload', sa.JSON()),
        sa.Column('is_read', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), index=True),
    )

    op.add_column('stores', sa.Column('notification_email', sa.String(length=255)))
    op.add_column('stores', sa.Column('notification_webhook_url', sa.String(length=500)))
    op.add_column('stores', sa.Column('low_stock_threshold', sa.Integer(), default=5))
    op.add_column('stores', sa.Column('auto_fulfill_enabled', sa.Boolean(), default=False))

    op.add_column('products', sa.Column('shopify_variant_id', sa.String(), index=True))
    op.add_column('products', sa.Column('cost', sa.Float()))


def downgrade() -> None:
    op.drop_column('products', 'cost')
    op.drop_column('products', 'shopify_variant_id')
    op.drop_column('stores', 'auto_fulfill_enabled')
    op.drop_column('stores', 'low_stock_threshold')
    op.drop_column('stores', 'notification_webhook_url')
    op.drop_column('stores', 'notification_email')
    op.drop_table('notifications')
    op.drop_table('automation_runs')
    op.drop_table('automation_rules')