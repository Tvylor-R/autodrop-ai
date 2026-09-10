import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database.database import Base, get_db as database_get_db
from app.database.store_model import Store
from app.core.dependencies import get_db
from app.services.user_service import create_user
from app.schemas.user import UserCreate


@pytest.fixture
def client_and_user():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestSession = sessionmaker(
        autocommit=False, autoflush=False, bind=engine
    )
    Base.metadata.create_all(bind=engine)

    def override():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    app.dependency_overrides[database_get_db] = override

    db = TestSession()
    user = create_user(
        db,
        UserCreate(
            full_name="Store User",
            email="storeuser@example.com",
            password="testpass123",
        ),
    )
    db.commit()
    client = TestClient(app)
    yield client, db, user
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(database_get_db, None)
    Base.metadata.drop_all(bind=engine)


def _auth(client):
    r = client.post(
        "/users/login",
        data={"username": "storeuser@example.com", "password": "testpass123"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_mine_empty(client_and_user):
    client, _, _ = client_and_user
    r = client.get("/stores/mine", headers=_auth(client))
    assert r.status_code == 200
    assert r.json()["stores"] == []


def test_claim_unclaimed_store(client_and_user):
    client, db, user = client_and_user
    db.add(Store(shop_domain="claim-test.myshopify.com", access_token="tok"))
    db.commit()

    r = client.post(
        "/stores/claim?shop=claim-test.myshopify.com",
        headers=_auth(client),
    )
    assert r.status_code == 200
    assert r.json()["claimed"] is True

    r = client.get("/stores/mine", headers=_auth(client))
    assert len(r.json()["stores"]) == 1
    assert r.json()["stores"][0]["shop_domain"] == "claim-test.myshopify.com"


def test_claim_already_owned_by_self(client_and_user):
    client, db, user = client_and_user
    db.add(
        Store(
            shop_domain="self-owned.myshopify.com",
            access_token="tok",
            user_id=user.id,
        )
    )
    db.commit()
    r = client.post(
        "/stores/claim?shop=self-owned.myshopify.com",
        headers=_auth(client),
    )
    assert r.status_code == 200
    assert r.json()["claimed"] is True


def test_claim_denied_when_owned_by_other(client_and_user):
    client, db, user = client_and_user
    other = create_user(
        db,
        UserCreate(
            full_name="Other",
            email="other@example.com",
            password="pass123",
        ),
    )
    db.add(
        Store(
            shop_domain="claimed.myshopify.com",
            access_token="tok",
            user_id=other.id,
        )
    )
    db.commit()
    r = client.post(
        "/stores/claim?shop=claimed.myshopify.com",
        headers=_auth(client),
    )
    assert r.status_code == 403


def test_claim_requires_auth(client_and_user):
    client, db, _ = client_and_user
    db.add(Store(shop_domain="noauth.myshopify.com", access_token="tok"))
    db.commit()
    r = client.post("/stores/claim?shop=noauth.myshopify.com")
    assert r.status_code == 401


def test_owned_store_visible(client_and_user):
    client, db, user = client_and_user
    db.add(
        Store(
            shop_domain="visible.myshopify.com",
            access_token="tok",
            user_id=user.id,
        )
    )
    db.commit()
    r = client.get(
        "/products/?shop=visible.myshopify.com",
        headers=_auth(client),
    )
    assert r.status_code == 200


def test_other_user_store_hidden(client_and_user):
    client, db, user = client_and_user
    other = create_user(
        db,
        UserCreate(
            full_name="Hidden",
            email="hiddenowner@example.com",
            password="pass123",
        ),
    )
    db.add(
        Store(
            shop_domain="hidden.myshopify.com",
            access_token="tok",
            user_id=other.id,
        )
    )
    db.commit()
    r = client.get(
        "/products/?shop=hidden.myshopify.com",
        headers=_auth(client),
    )
    assert r.status_code == 404
