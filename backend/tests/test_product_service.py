from app.services.product_service import (
    create_product,
    get_products,
    get_product,
    update_product,
    delete_product,
    get_product_by_shopify_id,
)


def test_create_product(db_session, sample_store):
    product = create_product(
        db_session,
        sample_store.id,
        "789",
        "New Product",
        "Vendor",
        "active",
    )

    assert product.title == "New Product"
    assert product.shopify_product_id == "789"
    assert product.store_id == sample_store.id


def test_create_product_updates_existing(db_session, sample_product):
    product = create_product(
        db_session,
        sample_product.store_id,
        sample_product.shopify_product_id,
        "Updated Title",
        "New Vendor",
        "draft",
    )

    assert product.id == sample_product.id
    assert product.title == "Updated Title"
    assert product.vendor == "New Vendor"


def test_get_products(db_session, sample_store, sample_product):
    products = get_products(db_session, sample_store.id)
    assert len(products) == 1
    assert products[0].id == sample_product.id


def test_get_product_by_shopify_id(db_session, sample_product):
    product = get_product_by_shopify_id(db_session, sample_product.store_id, "123456")
    assert product is not None
    assert product.id == sample_product.id


def test_update_product(db_session, sample_product):
    updated = update_product(
        db_session,
        sample_product.id,
        title="Renamed",
        status="draft",
    )
    assert updated.title == "Renamed"
    assert updated.status == "draft"


def test_update_product_not_found(db_session):
    updated = update_product(db_session, 9999, title="Nope")
    assert updated is None


def test_delete_product(db_session, sample_product):
    result = delete_product(db_session, sample_product.id)
    assert result is True
    assert get_product(db_session, sample_product.id) is None


def test_delete_product_not_found(db_session):
    result = delete_product(db_session, 9999)
    assert result is False