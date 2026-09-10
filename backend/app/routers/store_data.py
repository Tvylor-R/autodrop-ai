from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import User
from app.database.store_model import Store
from app.database.webhook_models import Order, InventoryLevel
from app.core.dependencies import get_current_user
from app.schemas.shopify import OrderResponse, InventoryResponse
from app.integrations.shopify import get_orders, get_inventory_levels, register_webhooks


router = APIRouter(
    prefix="/store",
    tags=["Store Data"]
)


def _get_store(db: Session, shop: str) -> Store:
    store = db.query(Store).filter(Store.shop_domain == shop).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


@router.get("/info")
def store_info(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    return {
        "shop_domain": store.shop_domain,
        "connected": bool(store.access_token),
        "created_at": store.created_at,
    }


@router.get("/orders", response_model=list[OrderResponse])
def list_orders(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    orders = (
        db.query(Order)
        .filter(Order.store_id == store.id)
        .order_by(Order.received_at.desc())
        .all()
    )

    return orders


@router.get("/orders/live")
def list_live_orders(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    if not store.access_token:
        raise HTTPException(status_code=400, detail="Store not connected via OAuth")

    data = get_orders(shop, store.access_token)
    return data.get("orders", [])


@router.get("/inventory", response_model=list[InventoryResponse])
def list_inventory(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    levels = (
        db.query(InventoryLevel)
        .filter(InventoryLevel.store_id == store.id)
        .all()
    )

    return levels


@router.get("/inventory/live")
def list_live_inventory(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    if not store.access_token:
        raise HTTPException(status_code=400, detail="Store not connected via OAuth")

    data = get_inventory_levels(shop, store.access_token)
    return data.get("inventory_levels", [])


@router.get("/inventory/alerts")
def low_stock_alerts(
    shop: str,
    threshold: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    low_stock = (
        db.query(InventoryLevel)
        .filter(
            InventoryLevel.store_id == store.id,
            InventoryLevel.available <= threshold,
        )
        .all()
    )

    return {
        "count": len(low_stock),
        "threshold": threshold,
        "items": [
            {
                "product_title": item.product_title,
                "sku": item.sku,
                "available": item.available,
            }
            for item in low_stock
        ],
    }


@router.post("/webhooks/register")
def setup_webhooks(
    shop: str,
    webhook_url: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    if not store.access_token:
        raise HTTPException(status_code=400, detail="Store not connected via OAuth")

    registered = register_webhooks(shop, store.access_token, webhook_url)

    return {
        "registered": registered,
        "total": len(registered),
    }
