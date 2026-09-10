import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import Base, get_db as database_get_db
from app.core.dependencies import get_db
from app.database.models import User
from app.database.store_model import Store
from app.database.product_model import Product
from app.services.user_service import create_user
from app.schemas.user import UserCreate


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def api_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestSession = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
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
    yield client

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(database_get_db, None)
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_user(db_session):
    user_data = UserCreate(
        full_name="Test User",
        email="test@example.com",
        password="testpass123",
    )
    return create_user(db_session, user_data)


@pytest.fixture
def sample_store(db_session):
    store = Store(
        shop_domain="test-store.myshopify.com",
        access_token="test-token",
    )
    db_session.add(store)
    db_session.commit()
    return store


@pytest.fixture
def sample_product(db_session, sample_store):
    product = Product(
        store_id=sample_store.id,
        shopify_product_id="123456",
        title="Test Product",
        vendor="Test Vendor",
        status="active",
    )
    db_session.add(product)
    db_session.commit()
    return product