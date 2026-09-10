from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.database.database import get_db
from app.database.models import User
from app.database.store_model import Store
from app.database.webhook_models import Order
from app.core.dependencies import get_current_user, get_user_store


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)


def _get_store(db: Session, user: User, shop: str) -> Store:
    return get_user_store(db, user, shop)


@router.get("/summary")
def analytics_summary(
    shop: str,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, current_user, shop)

    since = datetime.utcnow() - timedelta(days=days)

    orders = (
        db.query(Order)
        .filter(
            Order.store_id == store.id,
            Order.created_at_shopify >= since,
            Order.financial_status == "paid",
        )
        .all()
    )

    total_revenue = sum(o.total_price for o in orders)
    order_count = len(orders)
    avg_order_value = total_revenue / order_count if order_count else 0

    unpaid_orders = (
        db.query(Order)
        .filter(
            Order.store_id == store.id,
            Order.created_at_shopify >= since,
            Order.financial_status != "paid",
        )
        .count()
    )

    products = (
        db.query(Order)
        .filter(
            Order.store_id == store.id,
            Order.created_at_shopify >= since,
        )
        .all()
    )

    items_sold = 0
    for order in products:
        for item in order.line_items or []:
            items_sold += item.get("quantity", 0)

    return {
        "period_days": days,
        "total_revenue": round(total_revenue, 2),
        "order_count": order_count,
        "avg_order_value": round(avg_order_value, 2),
        "items_sold": items_sold,
        "pending_orders": unpaid_orders,
    }


@router.get("/revenue")
def analytics_revenue(
    shop: str,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, current_user, shop)
    since = datetime.utcnow() - timedelta(days=days)

    orders = (
        db.query(Order)
        .filter(
            Order.store_id == store.id,
            Order.created_at_shopify >= since,
            Order.financial_status == "paid",
        )
        .all()
    )

    daily: dict[str, float] = {}
    for order in orders:
        date = order.created_at_shopify.date().isoformat() if order.created_at_shopify else order.received_at.date().isoformat()
        daily[date] = round(daily.get(date, 0) + order.total_price, 2)

    return {"daily_revenue": daily, "total_days": len(orders)}


@router.get("/orders/trend")
def analytics_orders(
    shop: str,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, current_user, shop)
    since = datetime.utcnow() - timedelta(days=days)

    orders = (
        db.query(Order)
        .filter(
            Order.store_id == store.id,
            Order.created_at_shopify >= since,
        )
        .all()
    )

    daily: dict[str, int] = {}
    for order in orders:
        date = order.created_at_shopify.date().isoformat() if order.created_at_shopify else order.received_at.date().isoformat()
        daily[date] = daily.get(date, 0) + 1

    return {"daily_orders": daily, "total_orders": len(orders)}


@router.get("/best-products")
def analytics_best_products(
    shop: str,
    days: int = 30,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, current_user, shop)
    since = datetime.utcnow() - timedelta(days=days)

    orders = (
        db.query(Order)
        .filter(
            Order.store_id == store.id,
            Order.created_at_shopify >= since,
        )
        .all()
    )

    product_stats: dict[str, dict] = {}
    for order in orders:
        for item in order.line_items or []:
            pid = str(item.get("product_id", "unknown"))
            title = item.get("title", "Unknown")
            qty = item.get("quantity", 0)
            price = float(item.get("price", 0))

            if pid not in product_stats:
                product_stats[pid] = {"title": title, "quantity": 0, "revenue": 0.0}

            product_stats[pid]["quantity"] += qty
            product_stats[pid]["revenue"] += qty * price

    sorted_products = sorted(
        product_stats.values(),
        key=lambda p: p["quantity"],
        reverse=True,
    )[:limit]

    return {"best_products": sorted_products, "total": len(sorted_products)}