from app.services.webhook_service import (
    verify_webhook,
    process_order_created,
    process_order_updated,
    process_inventory_updated,
    process_product_updated,
)
from app.database.webhook_models import Order, InventoryLevel


class TestVerifyWebhook:
    def test_verify_no_secret(self, monkeypatch):
        monkeypatch.setattr("app.services.webhook_service.SHOPIFY_CLIENT_SECRET", None)
        assert verify_webhook(b"{}", "") is True


class TestOrderProcessing:
    def test_order_created(self, db_session, sample_store):
        data = {
            "id": 1001,
            "order_number": "1001",
            "total_price": "49.99",
            "currency": "USD",
            "financial_status": "paid",
            "customer": {
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "jane@example.com",
            },
            "line_items": [
                {"product_id": 1, "title": "Widget", "quantity": 2, "price": "24.99"}
            ],
            "created_at": "2025-06-01T12:00:00Z",
        }

        order = process_order_created(db_session, sample_store.id, data)

        assert order.shopify_order_id == "1001"
        assert order.total_price == 49.99
        assert order.customer_name == "Jane Doe"

        order2 = process_order_created(db_session, sample_store.id, data)
        assert order2.id == order.id

    def test_order_updated_existing(self, db_session, sample_store):
        data = {
            "id": 2002,
            "order_number": "2002",
            "total_price": "10.00",
            "financial_status": "pending",
            "customer": {"email": "x@y.com"},
            "created_at": "2025-06-01T12:00:00Z",
        }
        order = process_order_created(db_session, sample_store.id, data)

        data["financial_status"] = "paid"
        data["total_price"] = "15.00"
        updated = process_order_updated(db_session, sample_store.id, data)

        assert updated.id == order.id
        assert updated.financial_status == "paid"
        assert updated.total_price == 15.00


class TestInventoryProcessing:
    def test_inventory_created(self, db_session, sample_store):
        data = {
            "inventory_item_id": 500,
            "available": 25,
            "sku": "SKU-123",
            "name": "Cool Product",
            "updated_at": "2025-06-01T12:00:00Z",
        }
        level = process_inventory_updated(db_session, sample_store.id, data)

        assert level.available == 25
        assert level.sku == "SKU-123"

    def test_inventory_updated_existing(self, db_session, sample_store):
        data = {
            "inventory_item_id": 501,
            "available": 10,
            "sku": "SKU-2",
            "name": "Another",
        }
        level = process_inventory_updated(db_session, sample_store.id, data)

        data["available"] = 3
        updated = process_inventory_updated(db_session, sample_store.id, data)

        assert updated.id == level.id
        assert updated.available == 3


class TestProductProcessing:
    def test_product_updated_updates_existing(self, db_session, sample_product):
        data = {
            "id": sample_product.shopify_product_id,
            "title": "New Title",
            "vendor": "New Vendor",
            "status": "draft",
        }
        updated = process_product_updated(db_session, sample_product.store_id, data)

        assert updated is not None
        assert updated.title == "New Title"
        assert updated.vendor == "New Vendor"

    def test_product_updated_unknown_product(self, db_session, sample_store):
        data = {"id": "9999", "title": "X", "vendor": "Y"}
        result = process_product_updated(db_session, sample_store.id, data)
        assert result is None