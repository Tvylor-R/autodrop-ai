from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ShopifyProductCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body_html: str = ""
    vendor: Optional[str] = None
    product_type: Optional[str] = None
    tags: str = ""
    price: str = "0.00"
    sku: Optional[str] = None
    image_url: Optional[str] = None


class OrderFulfillRequest(BaseModel):
    order_id: int
    tracking_company: str = ""
    tracking_number: str = ""
    tracking_url: str = ""
    notify_customer: bool = False


class OrderCancelRequest(BaseModel):
    order_id: int
    reason: str = "other"


class InventoryUpdateRequest(BaseModel):
    location_id: int
    inventory_item_id: int
    available: int


class OrderResponse(BaseModel):
    id: int
    shopify_order_id: str
    order_number: str
    customer_name: str | None = None
    customer_email: str | None = None
    total_price: float
    currency: str | None = None
    financial_status: str | None = None
    fulfillment_status: str | None = None
    line_items: list | None = None
    shipping_address: dict | None = None
    created_at_shopify: datetime | None = None
    received_at: datetime

    model_config = {"from_attributes": True}


class InventoryResponse(BaseModel):
    id: int
    shopify_inventory_item_id: str
    product_title: str | None = None
    sku: str | None = None
    available: int
    incoming: int
    updated_at_shopify: datetime | None = None
    received_at: datetime

    model_config = {"from_attributes": True}


class WebhookRegistrationResponse(BaseModel):
    registered: list[str]
    total: int
