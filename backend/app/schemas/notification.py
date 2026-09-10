from pydantic import BaseModel
from datetime import datetime
from typing import Any


class NotificationResponse(BaseModel):
    id: int
    store_id: int
    type: str | None = None
    severity: str | None = None
    title: str | None = None
    message: str | None = None
    payload: dict[str, Any] | None = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    count: int