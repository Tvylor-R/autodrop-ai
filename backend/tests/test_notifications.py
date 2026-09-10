import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import Base
from app.database.store_model import Store
from app.database.webhook_models import InventoryLevel
from app.core.dependencies import get_db
from app.database.database import get_db as database_get_db


@pytest.fixture
def notification_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[database_get_db] = override_get_db

    client = TestClient(app)
    reg = client.post(
        "/users/register",
        json={
            "full_name": "Notif User",
            "email": "notif@example.com",
            "password": "testpass123",
        },
    )
    token = reg.json()["access_token"]

    db = TestSession()
    store = Store(
        shop_domain="notif-store.myshopify.com",
        access_token="token",
        low_stock_threshold=5,
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    db.add(
        InventoryLevel(
            store_id=store.id,
            shopify_inventory_item_id="9001",
            product_title="Running Out",
            sku="SKU-1",
            available=1,
        )
    )
    db.commit()
    db.close()

    client.headers.update({"Authorization": f"Bearer {token}"})
    yield client
    client.headers.pop("Authorization", None)
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(database_get_db, None)
    Base.metadata.drop_all(bind=engine)


SHOP = "notif-store.myshopify.com"


def _create_low_stock_rule(client):
    return client.post(
        "/automation/rules",
        params={"shop": SHOP},
        json={
            "name": "Alerts",
            "rule_type": "low_stock",
            "config": {"threshold": 5},
        },
    ).json()


def test_notifications_require_auth(api_client):
    response = api_client.get(
        "/notifications?shop=notif-store.myshopify.com"
    )
    assert response.status_code == 401


def test_update_store_settings(notification_client):
    response = notification_client.put(
        "/store/settings",
        params={"shop": SHOP},
        json={
            "notification_email": "owner@example.com",
            "notification_webhook_url": "https://hooks.example.com/xyz",
            "low_stock_threshold": 3,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["notification_email"] == "owner@example.com"
    assert data["notification_webhook_url"] == "https://hooks.example.com/xyz"
    assert data["low_stock_threshold"] == 3


def test_low_stock_notification_and_unread_flow(notification_client):
    rule = _create_low_stock_rule(notification_client)
    run = notification_client.post(
        f"/automation/rules/{rule['id']}/run",
        params={"shop": SHOP},
    )
    assert run.json()["count"] == 1

    unread = notification_client.get(
        "/notifications/unread-count", params={"shop": SHOP}
    )
    assert unread.json() == {"count": 1}

    notifications = notification_client.get(
        "/notifications", params={"shop": SHOP}
    )
    data = notifications.json()
    assert len(data) == 1
    assert data[0]["type"] == "low_stock"
    assert data[0]["severity"] == "warning"
    assert data[0]["is_read"] is False

    notification_id = data[0]["id"]
    read = notification_client.post(
        f"/notifications/{notification_id}/read", params={"shop": SHOP}
    )
    assert read.status_code == 200
    assert read.json()["is_read"] is True

    unread = notification_client.get(
        "/notifications/unread-count", params={"shop": SHOP}
    )
    assert unread.json() == {"count": 0}

    filtered = notification_client.get(
        "/notifications", params={"shop": SHOP, "unread_only": True}
    )
    assert filtered.json() == []


def test_mark_read_requires_ownership(notification_client):
    other = notification_client.post(
        "/notifications/999/read", params={"shop": SHOP}
    )
    assert other.status_code == 404


def test_deliver_webhook_notification(notification_client, monkeypatch):
    import app.services.notification_service as ns

    notification_client.put(
        "/store/settings",
        params={"shop": SHOP},
        json={"notification_webhook_url": "https://hooks.example.com/x"},
    )

    sent = {}

    class FakeResponse:
        status_code = 200

    def fake_post(url, json=None, timeout=None):
        sent["url"] = url
        sent["payload"] = json
        return FakeResponse()

    monkeypatch.setattr(ns.requests, "post", fake_post)

    rule = _create_low_stock_rule(notification_client)
    run = notification_client.post(
        f"/automation/rules/{rule['id']}/run",
        params={"shop": SHOP},
    )
    assert run.json()["count"] == 1

    delivered = notification_client.post(
        "/notifications/deliver", params={"shop": SHOP}
    )
    assert delivered.status_code == 200
    data = delivered.json()
    assert data["count"] == 1
    assert data["results"][0]["webhook"] is True

    assert sent["url"] == "https://hooks.example.com/x"
    assert sent["payload"]["type"] == "low_stock"
    assert sent["payload"]["title"].startswith("Low stock")


def test_deliver_no_channels_configured(notification_client, monkeypatch):
    import app.services.notification_service as ns

    monkeypatch.setattr(ns.smtplib, "SMTP", _noop_smtp)

    rule = _create_low_stock_rule(notification_client)
    notification_client.post(
        f"/automation/rules/{rule['id']}/run",
        params={"shop": SHOP},
    )

    delivered = notification_client.post(
        "/notifications/deliver", params={"shop": SHOP}
    )
    data = delivered.json()
    assert data["count"] == 1
    assert data["results"][0] == {"email": False, "webhook": False}


def _noop_smtp(*args, **kwargs):
    raise AssertionError("SMTP should not be contacted without configuration")