from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from datetime import datetime

from app.database.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)

    store_id = Column(
        Integer,
        ForeignKey("stores.id")
    )

    shopify_product_id = Column(
        String,
        unique=True,
        index=True
    )

    shopify_variant_id = Column(
        String,
        index=True
    )

    title = Column(String)

    vendor = Column(String)

    status = Column(String)

    cost = Column(Float)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )
