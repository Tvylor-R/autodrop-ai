from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import User
from app.database.store_model import Store
from app.core.dependencies import get_current_user, get_user_store
from app.services.store_service import save_store
from app.services.shopify_service import sync_products
from app.integrations.shopify import (
    get_install_url,
    exchange_token,
    register_webhooks,
)
from app.core.config import SHOPIFY_REDIRECT_URI, FRONTEND_URL


router = APIRouter(
    prefix="/shopify",
    tags=["Shopify"]
)


@router.get("/connect")
def connect(shop: str):
    if not shop:
        raise HTTPException(status_code=400, detail="Shop is required")

    url = get_install_url(shop)
    return RedirectResponse(url)


@router.get("/callback")
def callback(
    shop: str,
    code: str,
    request: Request,
    db: Session = Depends(get_db),
):
    if not shop or not code:
        raise HTTPException(status_code=400, detail="Missing shop or code")

    token_data = exchange_token(shop, code)

    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(
            status_code=400,
            detail=f"Token exchange failed: {token_data}"
        )

    store = save_store(db, shop, access_token)

    webhook_url = f"{str(request.base_url).rstrip('/')}/webhooks/shopify"
    registered = register_webhooks(shop, access_token, webhook_url)

    return RedirectResponse(
        f"{FRONTEND_URL}/shopify/callback?shop={shop}&status=success"
    )


@router.get("/sync")
def sync(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    store = get_user_store(db, current_user, shop)

    result = sync_products(db, store.id)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.get("/test")
def test(shop: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    store = get_user_store(db, current_user, shop)

    return {
        "shop": store.shop_domain,
        "has_token": bool(store.access_token)
    }
