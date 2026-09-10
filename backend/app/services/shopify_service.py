from sqlalchemy.orm import Session

from app.database.store_model import Store
from app.database.product_model import Product
from app.integrations.shopify import get_products as fetch_shopify_products
from app.services.product_service import create_product


def sync_products(db: Session, store_id: int):
    store = db.query(Store).filter(Store.id == store_id).first()

    if not store:
        return {"error": "Store not found"}

    data = fetch_shopify_products(store.shop_domain, store.access_token)

    shopify_products = data.get("products", [])

    synced = 0
    for p in shopify_products:
        create_product(
            db,
            store.id,
            str(p["id"]),
            p.get("title", "Untitled"),
            p.get("vendor"),
            p.get("status", "active")
        )
        synced += 1

    return {"synced": synced, "total": len(shopify_products)}


def get_store_products(db: Session, store_id: int):
    return (
        db.query(Product)
        .filter(Product.store_id == store_id)
        .all()
    )
