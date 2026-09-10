from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import platform

from app.database.database import get_db
from app.database.store_model import Store
from app.database.product_model import Product
from app.database.webhook_models import Order, InventoryLevel

router = APIRouter(
    prefix="/health",
    tags=["Health"]
)


@router.get("/")
def health():
    return {
        "status": "ok",
        "service": "autodrop-ai-api",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "python": platform.python_version(),
    }


@router.get("/db")
def health_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}


@router.get("/stats")
def health_stats(db: Session = Depends(get_db)):
    return {
        "stores": db.query(Store).count(),
        "products": db.query(Product).count(),
        "orders": db.query(Order).count(),
        "inventory_items": db.query(InventoryLevel).count(),
    }