"""add orders and inventory tables

Revision ID: e0b1417e1499
Revises: 2deaa18cec26
Create Date: 2026-09-10 11:08:52.331826
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e0b1417e1499'
down_revision: Union[str, None] = '2deaa18cec26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'products',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id')),
        sa.Column('shopify_product_id', sa.String(), unique=True, index=True),
        sa.Column('title', sa.String()),
        sa.Column('vendor', sa.String()),
        sa.Column('status', sa.String()),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
    )

    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id'), index=True),
        sa.Column('shopify_order_id', sa.String(), unique=True, index=True),
        sa.Column('order_number', sa.String()),
        sa.Column('customer_name', sa.String()),
        sa.Column('customer_email', sa.String()),
        sa.Column('total_price', sa.Float()),
        sa.Column('currency', sa.String(length=10)),
        sa.Column('financial_status', sa.String(length=50)),
        sa.Column('fulfillment_status', sa.String(length=50)),
        sa.Column('line_items', sa.JSON()),
        sa.Column('shipping_address', sa.JSON()),
        sa.Column('created_at_shopify', sa.DateTime()),
        sa.Column('updated_at_shopify', sa.DateTime()),
        sa.Column('received_at', sa.DateTime(), default=sa.func.now()),
    )

    op.create_table(
        'inventory_levels',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id'), index=True),
        sa.Column('shopify_inventory_item_id', sa.String(), index=True),
        sa.Column('shopify_product_id', sa.String(), index=True),
        sa.Column('product_title', sa.String()),
        sa.Column('sku', sa.String()),
        sa.Column('available', sa.Integer()),
        sa.Column('incoming', sa.Integer(), default=0),
        sa.Column('updated_at_shopify', sa.DateTime()),
        sa.Column('received_at', sa.DateTime(), default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('inventory_levels')
    op.drop_table('orders')
    op.drop_table('products')
