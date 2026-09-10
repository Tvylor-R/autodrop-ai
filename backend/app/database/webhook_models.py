from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from datetime import datetime

from app.database.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), index=True)
    shopify_order_id = Column(String, unique=True, index=True)
    order_number = Column(String)
    customer_name = Column(String)
    customer_email = Column(String)
    total_price = Column(Float)
    currency = Column(String(10))
    financial_status = Column(String(50))
    fulfillment_status = Column(String(50))
    line_items = Column(JSON)
    shipping_address = Column(JSON)
    created_at_shopify = Column(DateTime)
    updated_at_shopify = Column(DateTime)
    received_at = Column(DateTime, default=datetime.utcnow)


class InventoryLevel(Base):
    __tablename__ = "inventory_levels"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), index=True)
    shopify_inventory_item_id = Column(String, index=True)
    shopify_product_id = Column(String, index=True)
    product_title = Column(String)
    sku = Column(String)
    available = Column(Integer)
    incoming = Column(Integer, default=0)
    updated_at_shopify = Column(DateTime)
    received_at = Column(DateTime, default=datetime.utcnow)
