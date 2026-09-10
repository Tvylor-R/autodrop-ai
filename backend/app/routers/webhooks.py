from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
import json
import logging

from app.database.database import get_db
from app.services.webhook_service import (
    verify_webhook,
    get_store_by_shop,
    process_order_created,
    process_order_updated,
    process_inventory_updated,
    process_product_updated,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/webhooks",
    tags=["Webhooks"]
)


@router.post("/shopify")
async def shopify_webhook(request: Request, db: Session = Depends(get_db)):
    topic = request.headers.get("X-Shopify-Topic", "")
    shop = request.headers.get("X-Shopify-Shop-Domain", "")
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256", "")

    body = await request.body()

    if hmac_header and not verify_webhook(body, hmac_header):
        logger.warning(f"Invalid webhook HMAC from {shop}")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    store = get_store_by_shop(db, shop)
    if not store:
        logger.warning(f"Webhook for unknown store: {shop}")
        return {"status": "ignored"}

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    logger.info(f"Received webhook: topic={topic}, shop={shop}")

    if topic == "orders/create":
        process_order_created(db, store.id, data)
    elif topic == "orders/updated":
        process_order_updated(db, store.id, data)
    elif topic == "inventory_levels/update":
        process_inventory_updated(db, store.id, data)
    elif topic in ("products/create", "products/update"):
        process_product_updated(db, store.id, data)
    else:
        logger.info(f"Unhandled webhook topic: {topic}")

    return {"status": "ok"}
