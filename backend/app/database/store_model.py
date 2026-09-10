from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.database import Base


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    shop_domain = Column(String, unique=True, index=True)
    access_token = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
