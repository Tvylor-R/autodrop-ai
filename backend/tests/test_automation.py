import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import Base
from app.database.store_model import Store
from app.database.product_model import Product
from app.database.webhook_models import Order, InventoryLevel
from app.core.dependencies import get_db
from app.database.database import get_db as database_get_db


@pytest.fixture
def client_with_store():
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
            "full_name": "Automation User",
            "email": "auto@example.com",
            "password": "testpass123",
        },
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]

    db = TestSession()
    store = Store(
        shop_domain="auto-store.myshopify.com",
        access_token="auto-token",
        low_stock_threshold=5,
    )
    disconnected = Store(
        shop_domain="disconnected-store.myshopify.com",
        access_token=None,
    )
    db.add_all([store, disconnected])
    db.commit()
    db.refresh(store)

    db.add(
        Order(
            store_id=store.id,
            shopify_order_id="1001",
            order_number="A1001",
            financial_status="paid",
            fulfillment_status="unfulfilled",
            total_price=100.0,
        )
    )
    db.add_all(
        [
            Product(
                store_id=store.id,
                shopify_product_id="25",
                shopify_variant_id="2501",
                title="Repriced Product",
                status="active",
                cost=10.0,
            ),
            InventoryLevel(
                store_id=store.id,
                shopify_inventory_item_id="5001",
                product_title="Running Out",
                sku="SKU-LOW",
                available=2,
            ),
            InventoryLevel(
                store_id=store.id,
                shopify_inventory_item_id="5002",
                product_title="Well Stocked",
                sku="SKU-OK",
                available=50,
            ),
        ]
    )
    db.commit()
    db.close()

    client.headers.update({"Authorization": f"Bearer {token}"})
    yield client
    client.headers.pop("Authorization", None)
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(database_get_db, None)
    Base.metadata.drop_all(bind=engine)


SHOP = "auto-store.myshopify.com"


def test_rules_require_auth(api_client):
    response = api_client.get("/automation/rules?shop=auto-store.myshopify.com")
    assert response.status_code == 401


def test_create_and_list_rules(client_with_store):
    created = client_with_store.post(
        "/automation/rules",
        params={"shop": SHOP},
        json={
            "name": "Auto Fulfill Paid Orders",
            "rule_type": "auto_fulfill",
            "config": {"notify_customer": True},
            "enabled": True,
        },
    )
    assert created.status_code == 201
    data = created.json()
    assert data["rule_type"] == "auto_fulfill"
    assert data["config"]["notify_customer"] is True
    assert data["enabled"] is True

    listed = client_with_store.get(
        "/automation/rules", params={"shop": SHOP}
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_create_rule_invalid_type(client_with_store):
    response = client_with_store.post(
        "/automation/rules",
        params={"shop": SHOP},
        json={"name": "Bad", "rule_type": "not_a_type"},
    )
    assert response.status_code == 422


def test_update_and_toggle_rule(client_with_store):
    created = client_with_store.post(
        "/automation/rules",
        params={"shop": SHOP},
        json={"name": "Rule", "rule_type": "low_stock", "config": {}},
    ).json()

    updated = client_with_store.put(
        f"/automation/rules/{created['id']}",
        params={"shop": SHOP},
        json={"config": {"threshold": 3}},
    )
    assert updated.status_code == 200
    assert updated.json()["config"]["threshold"] == 3

    toggled = client_with_store.post(
        f"/automation/rules/{created['id']}/toggle",
        params={"shop": SHOP},
    )
    assert toggled.status_code == 200
    assert toggled.json()["enabled"] is False


def test_delete_rule(client_with_store):
    created = client_with_store.post(
        "/automation/rules",
        params={"shop": SHOP},
        json={"name": "Delete Me", "rule_type": "low_stock", "config": {}},
    ).json()

    deleted = client_with_store.delete(
        f"/automation/rules/{created['id']}", params={"shop": SHOP}
    )
    assert deleted.status_code == 204

    gone = client_with_store.get(
        "/automation/rules", params={"shop": SHOP}
    )
    assert gone.json() == []


def test_rule_belongs_to_store(client_with_store):
    response = client_with_store.post(
        "/automation/rules",
        params={"shop": "other-store.myshopify.com"},
        json={"name": "Other", "rule_type": "low_stock"},
    )
    assert response.status_code == 404


def test_run_auto_fulfill(client_with_store, monkeypatch):
    calls = []

    def fake_fulfill(shop, token, order_id, **kwargs):
        calls.append(order_id)
        return {"id": order_id}

    monkeypatch.setattr(
        "app.integrations.shopify.fulfill_order", fake_fulfill
    )

    rule = client_with_store.post(
        "/automation/rules",
        params={"shop": SHOP},
        json={
            "name": "Fulfill",
            "rule_type": "auto_fulfill",
            "config": {"notify_customer": False},
        },
    ).json()

    run = client_with_store.post(
        f"/automation/rules/{rule['id']}/run", params={"shop": SHOP}
    )
    assert run.status_code == 200
    data = run.json()
    assert data["status"] == "success"
    assert data["count"] == 1
    assert calls == [1001]

    runs = client_with_store.get(
        "/automation/runs", params={"shop": SHOP}
    )
    assert runs.status_code == 200
    assert len(runs.json()) == 1
    assert runs.json()[0]["status"] == "success"


def test_run_repricing(client_with_store, monkeypatch):
    prices = []

    def fake_update_price(shop, token, variant_id, price):
        prices.append((variant_id, price))

    monkeypatch.setattr(
        "app.integrations.shopify.update_product_price", fake_update_price
    )

    rule = client_with_store.post(
        "/automation/rules",
        params={"shop": SHOP},
        json={
            "name": "Reprice",
            "rule_type": "repricing",
            "config": {"margin_pct": 100},
        },
    ).json()

    run = client_with_store.post(
        f"/automation/rules/{rule['id']}/run", params={"shop": SHOP}
    )
    assert run.status_code == 200
    data = run.json()
    assert data["status"] == "success"
    assert data["count"] == 1
    assert prices == [(2501, 20.0)]


def test_run_low_stock_creates_notifications(client_with_store):
    rule = client_with_store.post(
        "/automation/rules",
        params={"shop": SHOP},
        json={
            "name": "Alerts",
            "rule_type": "low_stock",
            "config": {"threshold": 5},
        },
    ).json()

    run = client_with_store.post(
        f"/automation/rules/{rule['id']}/run", params={"shop": SHOP}
    )
    assert run.status_code == 200
    assert run.json()["status"] == "success"
    assert run.json()["count"] == 1

    notifications = client_with_store.get(
        "/notifications", params={"shop": SHOP}
    )
    assert notifications.status_code == 200
    data = notifications.json()
    assert len(data) == 1
    assert data[0]["type"] == "low_stock"
    assert data[0]["severity"] == "warning"


def test_run_skipped_when_store_disconnected(client_with_store, monkeypatch):
    created = client_with_store.post(
        "/automation/rules",
        params={"shop": "disconnected-store.myshopify.com"},
        json={"name": "Fulfill", "rule_type": "auto_fulfill"},
    )
    assert created.status_code == 201

    run = client_with_store.post(
        f"/automation/rules/{created.json()['id']}/run",
        params={"shop": "disconnected-store.myshopify.com"},
    )
    assert run.status_code == 200
    data = run.json()
    assert data["status"] == "skipped"
    assert data["error"] == "Store not connected via OAuth"