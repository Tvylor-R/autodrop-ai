import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import Base
from app.database.models import User
from app.database.store_model import Store
from app.core.dependencies import get_db
from app.database.database import get_db as database_get_db
from app.services.user_service import create_user
from app.schemas.user import UserCreate
from app.routers import bulk_import


class _SaveSpy:
    def __init__(self):
        self.calls = []

    def __call__(self, db, store_id, product, cost=None):
        self.calls.append({"store_id": store_id, "cost": cost})
        return {
            "id": product.get("id"),
            "title": product.get("title"),
            "vendor": product.get("vendor"),
            "status": "active",
            "cost": cost,
        }


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

    db = TestSession()
    user = create_user(
        db,
        UserCreate(
            full_name="Import User",
            email="import@example.com",
            password="testpass123",
        ),
    )
    db.add(
        Store(
            shop_domain="import-store.myshopify.com",
            access_token="import-token",
        )
    )
    db.commit()
    db.close()

    client = TestClient(app)
    yield client
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(database_get_db, None)
    Base.metadata.drop_all(bind=engine)


def _auth_header(client):
    login = client.post(
        "/users/login",
        data={"username": "import@example.com", "password": "testpass123"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_import_template(client_with_store):
    response = client_with_store.get("/import/template")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "Content-Disposition" in response.headers


def test_import_rejects_non_csv(client_with_store):
    header = _auth_header(client_with_store)
    response = client_with_store.post(
        "/import/products?shop=import-store.myshopify.com",
        headers=header,
        files={"file": ("products.txt", b"title\nhello", "text/plain")},
    )
    assert response.status_code == 400


def test_import_products(client_with_store, monkeypatch):
    counter = {"id": 900}

    def fake_create_product(shop, access_token, **kwargs):
        counter["id"] += 1
        return {
            "id": counter["id"],
            "title": kwargs["title"],
            "vendor": kwargs.get("vendor"),
            "status": "active",
        }

    monkeypatch.setattr(bulk_import, "create_product", fake_create_product)

    header = _auth_header(client_with_store)
    csv_content = "title,vendor,price,sku\nWidget One,Acme,9.99,WID-001\nWidget Two,Acme,12.99,WID-002"
    response = client_with_store.post(
        "/import/products?shop=import-store.myshopify.com",
        headers=header,
        files={"file": ("products.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["imported"] == 2
    assert data["failed"] == 0


def test_import_missing_title(client_with_store, monkeypatch):
    def fake_create_product(shop, access_token, **kwargs):
        return {
            "id": 1000,
            "title": kwargs["title"],
            "vendor": kwargs.get("vendor"),
            "status": "draft",
        }

    monkeypatch.setattr(bulk_import, "create_product", fake_create_product)

    header = _auth_header(client_with_store)
    csv_content = "title,vendor,price\n,NoName,9.99\nWidget,Acme,5.00"
    response = client_with_store.post(
        "/import/products?shop=import-store.myshopify.com",
        headers=header,
        files={"file": ("products.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["imported"] == 1
    assert data["failed"] == 1
    assert data["errors"][0]["error"] == "Missing title"


def test_import_shopify_failure(client_with_store, monkeypatch):
    def fake_create_product(shop, access_token, **kwargs):
        raise Exception("Shopify API down")

    monkeypatch.setattr(bulk_import, "create_product", fake_create_product)

    header = _auth_header(client_with_store)
    csv_content = "title,vendor,price\nWidget,Acme,9.99"
    response = client_with_store.post(
        "/import/products?shop=import-store.myshopify.com",
        headers=header,
        files={"file": ("products.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imported"] == 0
    assert data["failed"] == 1
    assert "Shopify API down" in data["errors"][0]["error"]


def test_import_requires_auth(client_with_store):
    response = client_with_store.post(
        "/import/products?shop=import-store.myshopify.com",
        files={"file": ("products.csv", b"title\nWidget", "text/csv")},
    )
    assert response.status_code == 401


def test_import_stores_cost(client_with_store, monkeypatch):
    def fake_create_product(shop, access_token, **kwargs):
        return {
            "id": 2000,
            "title": kwargs["title"],
            "vendor": kwargs.get("vendor"),
            "status": "active",
        }

    spy = _SaveSpy()

    monkeypatch.setattr(bulk_import, "create_product", fake_create_product)
    monkeypatch.setattr(bulk_import, "_save_local_product", spy)

    header = _auth_header(client_with_store)
    csv_content = "title,vendor,price,cost\nWidget,Acme,19.99,8.50"
    response = client_with_store.post(
        "/import/products?shop=import-store.myshopify.com",
        headers=header,
        files={"file": ("products.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    assert response.json()["imported"] == 1
    assert spy.calls[0]["cost"] == 8.5


def test_import_rejects_invalid_cost(client_with_store, monkeypatch):
    def fake_create_product(shop, access_token, **kwargs):
        return {"id": 2001, "title": kwargs["title"]}

    monkeypatch.setattr(bulk_import, "create_product", fake_create_product)

    header = _auth_header(client_with_store)
    csv_content = "title,vendor,cost\nWidget,Acme,not-a-number"
    response = client_with_store.post(
        "/import/products?shop=import-store.myshopify.com",
        headers=header,
        files={"file": ("products.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imported"] == 0
    assert data["failed"] == 1
    assert "Invalid cost" in data["errors"][0]["error"]