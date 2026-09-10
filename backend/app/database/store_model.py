from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.database import Base


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    shop_domain = Column(String, unique=True, index=True)
    access_token = Column(String)
    notification_email = Column(String(255))
    notification_webhook_url = Column(String(500))
    low_stock_threshold = Column(Integer, default=5)
    auto_fulfill_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
