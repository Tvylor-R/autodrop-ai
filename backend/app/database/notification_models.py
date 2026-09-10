from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text
from datetime import datetime

from app.database.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), index=True)
    type = Column(String(50), index=True)
    severity = Column(String(20), default="info")
    title = Column(String(255))
    message = Column(Text)
    payload = Column(JSON)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)