from celery import Celery

from app.core.config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND

celery_app = Celery(
    "autodrop_ai",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

celery_app.autodiscover_tasks(["app.worker"])

celery_app.conf.beat_schedule = {
    "sync-products-every-6-hours": {
        "task": "app.sync_products",
        "schedule": 21600.0,
    },
    "run-auto-fulfill-every-5-minutes": {
        "task": "app.run_automation_rules",
        "schedule": 300.0,
        "kwargs": {"rule_type": "auto_fulfill"},
    },
    "run-repricing-every-6-hours": {
        "task": "app.run_automation_rules",
        "schedule": 21600.0,
        "kwargs": {"rule_type": "repricing"},
    },
    "run-low-stock-every-15-minutes": {
        "task": "app.run_automation_rules",
        "schedule": 900.0,
        "kwargs": {"rule_type": "low_stock"},
    },
    "deliver-notifications-every-minute": {
        "task": "app.deliver_pending_notifications",
        "schedule": 60.0,
    },
}