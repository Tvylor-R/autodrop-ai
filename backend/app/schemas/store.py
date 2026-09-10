from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class StoreSettingsUpdate(BaseModel):
    notification_email: Optional[str] = None
    notification_webhook_url: Optional[str] = None
    low_stock_threshold: Optional[int] = Field(default=None, ge=1, le=100000)


class StoreInfoResponse(BaseModel):
    shop_domain: str | None = None
    connected: bool
    notification_email: str | None = None
    notification_webhook_url: str | None = None
    low_stock_threshold: int | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}