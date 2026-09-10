import hmac
import hashlib
import base64
import json
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.config import SHOPIFY_CLIENT_SECRET
from app.database.store_model import Store
from app.database.webhook_models import Order, InventoryLevel
from app.database.product_model import Product
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)


def verify_webhook(body: bytes, hmac_header: str) -> bool:
    if not SHOPIFY_CLIENT_SECRET:
        logger.warning("SHOPIFY_CLIENT_SECRET not set, skipping verification")
        return True

    computed = hmac.new(
        SHOPIFY_CLIENT_SECRET.encode("utf-8"),
        body,
        hashlib.sha256
    ).digest()

    digest = base64.b64encode(computed).decode("utf-8")
    return hmac.compare_digest(digest, hmac_header)


def get_store_by_shop(db: Session, shop: str) -> Store | None:
    return db.query(Store).filter(Store.shop_domain == shop).first()


def process_order_created(db: Session, store_id: int, data: dict):
    shopify_order_id = str(data.get("id", ""))

    existing = db.query(Order).filter(
        Order.shopify_order_id == shopify_order_id
    ).first()

    if existing:
        return existing

    line_items = []
    for item in data.get("line_items", []):
        line_items.append({
            "product_id": item.get("product_id"),
            "variant_id": item.get("variant_id"),
            "title": item.get("title"),
            "quantity": item.get("quantity"),
            "price": item.get("price"),
            "sku": item.get("sku"),
        })

    shipping = None
    if data.get("shipping_address"):
        addr = data["shipping_address"]
        shipping = {
            "name": addr.get("name"),
            "address1": addr.get("address1"),
            "address2": addr.get("address2"),
            "city": addr.get("city"),
            "province": addr.get("province"),
            "zip": addr.get("zip"),
            "country": addr.get("country"),
        }

    customer = data.get("customer", {}) or {}

    order = Order(
        store_id=store_id,
        shopify_order_id=shopify_order_id,
        order_number=str(data.get("order_number", "")),
        customer_name=f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip(),
        customer_email=customer.get("email"),
        total_price=float(data.get("total_price", 0)),
        currency=data.get("currency", "USD"),
        financial_status=data.get("financial_status", "pending"),
        fulfillment_status=data.get("fulfillment_status"),
        line_items=line_items,
        shipping_address=shipping,
        created_at_shopify=_parse_shopify_date(data.get("created_at")),
        updated_at_shopify=_parse_shopify_date(data.get("updated_at")),
    )

    db.add(order)
    db.commit()
    logger.info(f"Order created: {shopify_order_id} for store {store_id}")

    create_notification(
        db,
        store_id,
        "order_received",
        title=f"New order {data.get('order_number', shopify_order_id)}",
        message=(
            f"Order {data.get('order_number', shopify_order_id)} for "
            f"${float(data.get('total_price', 0)):.2f} "
            f"({data.get('financial_status', 'unknown')})."
        ),
        severity="info",
        payload={
            "shopify_order_id": shopify_order_id,
            "order_number": data.get("order_number"),
            "total_price": data.get("total_price"),
        },
    )
    return order


def process_order_updated(db: Session, store_id: int, data: dict):
    shopify_order_id = str(data.get("id", ""))

    order = db.query(Order).filter(
        Order.shopify_order_id == shopify_order_id
    ).first()

    if not order:
        return process_order_created(db, store_id, data)

    order.financial_status = data.get("financial_status", order.financial_status)
    order.fulfillment_status = data.get("fulfillment_status", order.fulfillment_status)
    order.total_price = float(data.get("total_price", order.total_price))
    order.updated_at_shopify = _parse_shopify_date(data.get("updated_at"))

    db.commit()
    logger.info(f"Order updated: {shopify_order_id}")

    if order.fulfillment_status == "fulfilled":
        create_notification(
            db,
            store_id,
            "order_fulfilled",
            title=f"Order {order.order_number or shopify_order_id} fulfilled",
            message=(
                f"Order {order.order_number or shopify_order_id} "
                f"({order.total_price:.2f} {order.currency or 'USD'}) was fulfilled."
            ),
            severity="info",
            payload={
                "shopify_order_id": shopify_order_id,
                "order_number": order.order_number,
            },
        )
    return order


def process_inventory_updated(db: Session, store_id: int, data: dict):
    inventory_item_id = str(data.get("inventory_item_id", ""))

    available = data.get("available", 0)

    existing = db.query(InventoryLevel).filter(
        InventoryLevel.store_id == store_id,
        InventoryLevel.shopify_inventory_item_id == inventory_item_id,
    ).first()

    if existing:
        existing.available = available
        existing.incoming = data.get("incoming", 0)
        existing.updated_at_shopify = _parse_shopify_date(data.get("updated_at"))
        db.commit()
        logger.info(f"Inventory updated: item {inventory_item_id}, available={available}")
        return existing

    product_title = data.get("name", "")
    sku = data.get("sku", "")

    inv = InventoryLevel(
        store_id=store_id,
        shopify_inventory_item_id=inventory_item_id,
        product_title=product_title,
        sku=sku,
        available=available,
        incoming=data.get("incoming", 0),
        updated_at_shopify=_parse_shopify_date(data.get("updated_at")),
    )

    db.add(inv)
    db.commit()
    logger.info(f"Inventory created: item {inventory_item_id}, available={available}")
    return inv


def process_product_updated(db: Session, store_id: int, data: dict):
    shopify_product_id = str(data.get("id", ""))

    existing = db.query(Product).filter(
        Product.store_id == store_id,
        Product.shopify_product_id == shopify_product_id,
    ).first()

    if existing:
        existing.title = data.get("title", existing.title)
        existing.vendor = data.get("vendor", existing.vendor)
        existing.status = data.get("status", existing.status)
        db.commit()
        logger.info(f"Product updated: {shopify_product_id}")
        return existing

    return None


def _parse_shopify_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
