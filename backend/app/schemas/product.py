from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ProductCreate(BaseModel):
    shopify_product_id: str
    title: str
    vendor: Optional[str] = None
    status: Optional[str] = "active"
    cost: Optional[float] = None
    shopify_variant_id: Optional[str] = None


class ProductUpdate(BaseModel):
    title: Optional[str] = None
    vendor: Optional[str] = None
    status: Optional[str] = None
    cost: Optional[float] = None
    shopify_variant_id: Optional[str] = None


class ProductResponse(BaseModel):
    id: int
    store_id: int
    shopify_product_id: str
    shopify_variant_id: Optional[str] = None
    title: str
    vendor: Optional[str] = None
    status: Optional[str] = None
    cost: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}
