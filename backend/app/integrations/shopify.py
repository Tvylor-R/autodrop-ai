import requests
import logging

from app.core.config import (
    SHOPIFY_CLIENT_ID,
    SHOPIFY_CLIENT_SECRET,
    SHOPIFY_REDIRECT_URI,
)

logger = logging.getLogger(__name__)

SHOPIFY_API_VERSION = "2025-01"


def get_install_url(shop: str):
    shop = shop.replace("https://", "").replace("http://", "").rstrip("/")

    scopes = ",".join([
        "read_products",
        "write_products",
        "read_inventory",
        "write_inventory",
        "read_orders",
    ])

    return (
        f"https://{shop}/admin/oauth/authorize"
        f"?client_id={SHOPIFY_CLIENT_ID}"
        f"&scope={scopes}"
        f"&redirect_uri={SHOPIFY_REDIRECT_URI}"
    )


def exchange_token(shop: str, code: str):
    url = f"https://{shop}/admin/oauth/access_token"

    response = requests.post(
        url,
        json={
            "client_id": SHOPIFY_CLIENT_ID,
            "client_secret": SHOPIFY_CLIENT_SECRET,
            "code": code,
        },
    )

    return response.json()


def get_products(shop: str, access_token: str):
    url = f"https://{shop}/admin/api/{SHOPIFY_API_VERSION}/products.json"

    response = requests.get(
        url,
        headers={
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        },
    )

    return response.json()


def register_webhooks(shop: str, access_token: str, webhook_url: str):
    url = f"https://{shop}/admin/api/{SHOPIFY_API_VERSION}/webhooks.json"

    topics = [
        "orders/create",
        "orders/updated",
        "inventory_levels/update",
        "products/create",
        "products/update",
    ]

    registered = []
    for topic in topics:
        response = requests.post(
            url,
            headers={
                "X-Shopify-Access-Token": access_token,
                "Content-Type": "application/json",
            },
            json={
                "webhook": {
                    "topic": topic,
                    "address": webhook_url,
                    "format": "json",
                }
            },
        )

        if response.status_code == 201:
            registered.append(topic)
        else:
            logger.warning(f"Failed to register webhook {topic}: {response.text}")

    return registered


def get_orders(shop: str, access_token: str, limit: int = 50):
    url = f"https://{shop}/admin/api/{SHOPIFY_API_VERSION}/orders.json?limit={limit}&status=any"

    response = requests.get(
        url,
        headers={
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        },
    )

    return response.json()


def get_inventory_levels(shop: str, access_token: str):
    url = f"https://{shop}/admin/api/{SHOPIFY_API_VERSION}/inventory_levels.json"

    response = requests.get(
        url,
        headers={
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        },
    )

    return response.json()


def create_product(
    shop: str,
    access_token: str,
    title: str,
    body_html: str = "",
    vendor: str = None,
    product_type: str = None,
    tags: str = "",
    variants: list = None,
    images: list = None,
):
    url = f"https://{shop}/admin/api/{SHOPIFY_API_VERSION}/products.json"

    product = {
        "title": title,
        "body_html": body_html,
        "tags": tags,
    }
    if vendor:
        product["vendor"] = vendor
    if product_type:
        product["product_type"] = product_type
    if variants is not None:
        product["variants"] = variants
    if images is not None:
        product["images"] = images

    response = requests.post(
        url,
        headers={
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        },
        json={"product": product},
    )

    if response.status_code not in (200, 201):
        logger.error(f"Failed to create product: {response.text}")
        raise Exception(response.text)

    return response.json()["product"]


def get_locations(shop: str, access_token: str):
    url = f"https://{shop}/admin/api/{SHOPIFY_API_VERSION}/locations.json"

    response = requests.get(
        url,
        headers={
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        },
    )

    return response.json().get("locations", [])


def update_inventory_level(
    shop: str,
    access_token: str,
    location_id: int,
    inventory_item_id: int,
    available: int,
):
    url = f"https://{shop}/admin/api/{SHOPIFY_API_VERSION}/inventory_levels/set.json"

    response = requests.post(
        url,
        headers={
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        },
        json={
            "location_id": location_id,
            "inventory_item_id": inventory_item_id,
            "available": available,
        },
    )

    if response.status_code not in (200, 201):
        logger.error(f"Failed to update inventory: {response.text}")
        raise Exception(response.text)

    return response.json()


def fulfill_order(
    shop: str,
    access_token: str,
    order_id: int,
    tracking_company: str = "",
    tracking_number: str = "",
    tracking_url: str = "",
    notify_customer: bool = False,
):
    url = f"https://{shop}/admin/api/{SHOPIFY_API_VERSION}/fulfillments.json"

    fulfillment = {
        "tracking_number": tracking_number,
        "notify_customer": notify_customer,
    }
    if tracking_company:
        fulfillment["tracking_company"] = tracking_company
    if tracking_url:
        fulfillment["tracking_url"] = tracking_url

    response = requests.post(
        url,
        headers={
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        },
        json={"fulfillment": fulfillment},
    )

    if response.status_code not in (200, 201):
        logger.error(f"Failed to fulfill order: {response.text}")
        raise Exception(response.text)

    return response.json()["fulfillment"]


def cancel_order(
    shop: str,
    access_token: str,
    order_id: int,
    reason: str = "other",
):
    url = (
        f"https://{shop}/admin/api/{SHOPIFY_API_VERSION}/orders/{order_id}/cancel.json"
    )

    response = requests.post(
        url,
        headers={
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        },
        json={"reason": reason},
    )

    if response.status_code not in (200, 201):
        logger.error(f"Failed to cancel order: {response.text}")
        raise Exception(response.text)

    return response.json()["order"]
