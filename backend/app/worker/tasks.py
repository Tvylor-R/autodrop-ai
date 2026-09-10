import logging

from app.database.database import SessionLocal
from app.database.store_model import Store
from app.services.automation_service import get_rules, run_rule_now
from app.services.notification_service import deliver_pending
from app.services.shopify_service import sync_products
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.sync_products")
def sync_products_task(store_id: int | None = None):
    db = SessionLocal()
    try:
        stores = db.query(Store).all()
        if store_id is not None:
            stores = [s for s in stores if s.id == store_id]

        results = []
        for store in stores:
            results.append({"store": store.shop_domain, **sync_products(db, store.id)})
        return {"results": results}
    finally:
        db.close()


@celery_app.task(name="app.run_automation_rules")
def run_automation_rules_task(store_id: int | None = None, rule_type: str | None = None):
    db = SessionLocal()
    try:
        stores = db.query(Store).all()
        if store_id is not None:
            stores = [s for s in stores if s.id == store_id]

        results = []
        for store in stores:
            for rule in get_rules(db, store.id):
                if not rule.enabled:
                    continue
                if rule_type and rule.rule_type != rule_type:
                    continue
                try:
                    result = run_rule_now(db, store, rule)
                    results.append({"rule": rule.id, **result})
                except Exception as e:
                    logger.exception(f"Rule {rule.id} failed in worker")
                    results.append({"rule": rule.id, "status": "error", "error": str(e)})
        return {"results": results}
    finally:
        db.close()


@celery_app.task(name="app.deliver_pending_notifications")
def deliver_pending_notifications_task(store_id: int | None = None):
    db = SessionLocal()
    try:
        stores = db.query(Store).all()
        if store_id is not None:
            stores = [s for s in stores if s.id == store_id]

        results = []
        for store in stores:
            results.append({"store": store.shop_domain, **deliver_pending(db, store.id)})
        return {"results": results}
    finally:
        db.close()