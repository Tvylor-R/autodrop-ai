import logging
from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import OPENAI_API_KEY
from app.database.automation_models import AutomationRule, AutomationRun
from app.database.product_model import Product
from app.database.store_model import Store
from app.database.webhook_models import Order, InventoryLevel
from app.integrations import shopify
from app.services import ai_service
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)

RULE_TYPES = ["auto_fulfill", "repricing", "low_stock"]

PAID_STATUSES = ["paid", "partially_paid"]


def get_rules(db: Session, store_id: int):
    return (
        db.query(AutomationRule)
        .filter(AutomationRule.store_id == store_id)
        .order_by(AutomationRule.created_at.desc())
        .all()
    )


def get_rule(db: Session, rule_id: int, store_id: int):
    return (
        db.query(AutomationRule)
        .filter(
            AutomationRule.id == rule_id,
            AutomationRule.store_id == store_id,
        )
        .first()
    )


def get_runs(db: Session, store_id: int, rule_id: int | None = None, limit: int = 50):
    query = db.query(AutomationRun).join(
        AutomationRule, AutomationRun.rule_id == AutomationRule.id
    ).filter(AutomationRule.store_id == store_id)
    if rule_id is not None:
        query = query.filter(AutomationRun.rule_id == rule_id)
    return query.order_by(AutomationRun.ran_at.desc()).limit(limit).all()


def create_rule(
    db: Session,
    store_id: int,
    name: str,
    rule_type: str,
    config: dict | None = None,
    enabled: bool = True,
) -> AutomationRule:
    rule = AutomationRule(
        store_id=store_id,
        name=name,
        rule_type=rule_type,
        config=config or {},
        enabled=enabled,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def update_rule(
    db: Session,
    rule: AutomationRule,
    name: str | None = None,
    config: dict | None = None,
    enabled: bool | None = None,
) -> AutomationRule:
    if name is not None:
        rule.name = name
    if config is not None:
        rule.config = config
    if enabled is not None:
        rule.enabled = enabled
    db.commit()
    db.refresh(rule)
    return rule


def delete_rule(db: Session, rule: AutomationRule) -> None:
    db.delete(rule)
    db.commit()


def _record_run(
    db: Session,
    rule: AutomationRule,
    status: str,
    count: int = 0,
    error: str | None = None,
    summary: str = "",
) -> AutomationRun:
    rule.last_run_at = datetime.utcnow()
    rule.last_status = status
    rule.last_count = count
    rule.last_error = error
    run = AutomationRun(
        rule_id=rule.id,
        status=status,
        summary=summary or error or status,
        error=error,
    )
    db.add(run)
    db.commit()
    db.refresh(rule)
    return run


def run_auto_fulfill(
    db: Session, store: Store, rule: AutomationRule
) -> dict:
    if not store.access_token:
        return {
            "status": "skipped",
            "count": 0,
            "error": "Store not connected via OAuth",
        }

    config = rule.config or {}
    notify_customer = bool(config.get("notify_customer", False))

    orders = (
        db.query(Order)
        .filter(
            Order.store_id == store.id,
            Order.financial_status.in_(PAID_STATUSES),
            or_(
                Order.fulfillment_status.is_(None),
                Order.fulfillment_status.in_(["unfulfilled", ""]),
            ),
        )
        .all()
    )

    fulfilled = 0
    errors = []
    for order in orders:
        try:
            shopify.fulfill_order(
                store.shop_domain,
                store.access_token,
                order_id=int(order.shopify_order_id),
                notify_customer=notify_customer,
            )
            order.fulfillment_status = "fulfilled"
            db.commit()
            fulfilled += 1
        except Exception as e:
            logger.warning(
                f"Auto-fulfill failed for order {order.shopify_order_id}: {e}"
            )
            errors.append(str(e))

    status = "skipped" if fulfilled == 0 and not errors else "success"
    return {
        "status": status,
        "count": fulfilled,
        "error": "; ".join(errors[:3]) or None,
        "summary": f"Fulfilled {fulfilled} order(s)",
    }


def run_repricing(
    db: Session, store: Store, rule: AutomationRule
) -> dict:
    if not store.access_token:
        return {
            "status": "skipped",
            "count": 0,
            "error": "Store not connected via OAuth",
        }

    config = rule.config or {}
    margin_pct = float(config.get("margin_pct", 50))
    use_ai = bool(config.get("use_ai", False))

    products = (
        db.query(Product)
        .filter(
            Product.store_id == store.id,
            Product.shopify_variant_id.isnot(None),
        )
        .all()
    )

    updated = 0
    errors = []
    for product in products:
        try:
            suggested = None
            if product.cost:
                suggested = round(product.cost * (1 + margin_pct / 100), 2)
            elif use_ai and OPENAI_API_KEY:
                result = ai_service.optimize_pricing(
                    product.title, cost_price=product.cost
                )
                suggested = round(float(result.get("suggested_price", 0)), 2)

            if not suggested or suggested <= 0:
                continue

            shopify.update_product_price(
                store.shop_domain,
                store.access_token,
                variant_id=int(product.shopify_variant_id),
                price=suggested,
            )
            updated += 1
        except Exception as e:
            logger.warning(
                f"Repricing failed for product {product.shopify_product_id}: {e}"
            )
            errors.append(str(e))

    return {
        "status": "skipped" if updated == 0 and not errors else "success",
        "count": updated,
        "error": "; ".join(errors[:3]) or None,
        "summary": f"Repriced {updated} product(s)",
    }


def run_low_stock(
    db: Session, store: Store, rule: AutomationRule
) -> dict:
    config = rule.config or {}
    threshold = int(config.get("threshold", store.low_stock_threshold or 5))

    items = (
        db.query(InventoryLevel)
        .filter(
            InventoryLevel.store_id == store.id,
            InventoryLevel.available <= threshold,
        )
        .all()
    )

    created = 0
    for item in items:
        label = item.product_title or item.sku or item.shopify_inventory_item_id
        create_notification(
            db,
            store.id,
            "low_stock",
            title=f"Low stock: {label}",
            message=(
                f"Only {item.available} unit(s) remaining for {label} "
                f"(threshold {threshold})."
            ),
            severity="warning",
            payload={
                "sku": item.sku,
                "available": item.available,
                "threshold": threshold,
                "inventory_item_id": item.shopify_inventory_item_id,
            },
        )
        created += 1

    return {
        "status": "skipped" if created == 0 else "success",
        "count": created,
        "error": None,
        "summary": f"Created {created} low-stock alert(s)",
    }


def run_rule_now(db: Session, store: Store, rule: AutomationRule) -> dict:
    if rule.rule_type == "auto_fulfill":
        result = run_auto_fulfill(db, store, rule)
    elif rule.rule_type == "repricing":
        result = run_repricing(db, store, rule)
    elif rule.rule_type == "low_stock":
        result = run_low_stock(db, store, rule)
    else:
        result = {
            "status": "error",
            "count": 0,
            "error": f"Unknown rule type: {rule.rule_type}",
            "summary": "Unknown rule type",
        }

    run = _record_run(
        db,
        rule,
        status=result["status"],
        count=result.get("count", 0),
        error=result.get("error"),
        summary=result.get("summary", ""),
    )

    return {
        "status": result["status"],
        "count": result.get("count", 0),
        "error": result.get("error"),
        "summary": result.get("summary"),
        "last_run_at": rule.last_run_at,
        "run": {
            "id": run.id,
            "rule_id": run.rule_id,
            "status": run.status,
            "summary": run.summary,
            "ran_at": run.ran_at,
        },
    }