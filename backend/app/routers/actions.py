from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import User
from app.database.store_model import Store
from app.database.product_model import Product
from app.core.dependencies import get_current_user
from app.schemas.shopify import (
    ShopifyProductCreate,
    OrderFulfillRequest,
    OrderCancelRequest,
    InventoryUpdateRequest,
)
from app.integrations.shopify import (
    create_product,
    get_locations,
    update_inventory_level,
    fulfill_order,
    cancel_order,
)


router = APIRouter(
    prefix="/actions",
    tags=["Shopify Actions"]
)


def _get_store(db: Session, shop: str) -> Store:
    store = db.query(Store).filter(Store.shop_domain == shop).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if not store.access_token:
        raise HTTPException(status_code=400, detail="Store not connected via OAuth")
    return store


@router.get("/locations")
def list_locations(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)
    return get_locations(shop, store.access_token)


@router.post("/products")
def create_shopify_product(
    shop: str,
    payload: ShopifyProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    variants = [
        {
            "price": payload.price or "0.00",
        }
    ]
    if payload.sku:
        variants[0]["sku"] = payload.sku

    body_html = payload.body_html
    if payload.image_url:
        body_html += f'\n<img src="{payload.image_url}" />'

    try:
        product = create_product(
            shop,
            store.access_token,
            title=payload.title,
            body_html=body_html,
            vendor=payload.vendor,
            product_type=payload.product_type,
            tags=payload.tags,
            variants=variants,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shopify error: {e}")

    db_product = Product(
        store_id=store.id,
        shopify_product_id=str(product.get("id")),
        title=product.get("title"),
        vendor=product.get("vendor"),
        status=product.get("status", "active"),
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)

    return {
        "product": product,
        "local_product": {
            "id": db_product.id,
            "shopify_product_id": db_product.shopify_product_id,
            "title": db_product.title,
            "status": db_product.status,
        },
    }


@router.post("/orders/fulfill")
def fulfill(
    shop: str,
    payload: OrderFulfillRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    try:
        result = fulfill_order(
            shop,
            store.access_token,
            order_id=payload.order_id,
            tracking_company=payload.tracking_company,
            tracking_number=payload.tracking_number,
            tracking_url=payload.tracking_url,
            notify_customer=payload.notify_customer,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shopify error: {e}")

    return {"fulfillment": result}


@router.post("/orders/cancel")
def cancel(
    shop: str,
    payload: OrderCancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    try:
        result = cancel_order(
            shop,
            store.access_token,
            order_id=payload.order_id,
            reason=payload.reason,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shopify error: {e}")

    return {"order": result}


@router.post("/inventory/update")
def set_inventory(
    shop: str,
    payload: InventoryUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    try:
        result = update_inventory_level(
            shop,
            store.access_token,
            location_id=payload.location_id,
            inventory_item_id=payload.inventory_item_id,
            available=payload.available,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shopify error: {e}")

    return result