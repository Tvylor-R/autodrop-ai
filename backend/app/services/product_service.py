from sqlalchemy.orm import Session

from app.database.product_model import Product


def get_products(db: Session, store_id: int):
    return db.query(Product).filter(Product.store_id == store_id).all()


def get_product_by_shopify_id(db: Session, store_id: int, shopify_product_id: str):
    return (
        db.query(Product)
        .filter(
            Product.store_id == store_id,
            Product.shopify_product_id == shopify_product_id
        )
        .first()
    )


def get_product(db: Session, product_id: int):
    return db.query(Product).filter(Product.id == product_id).first()


def create_product(db: Session, store_id: int, shopify_product_id: str, title: str, vendor: str = None, status: str = "active", cost: float = None, shopify_variant_id: str = None):
    existing = get_product_by_shopify_id(db, store_id, shopify_product_id)
    if existing:
        existing.title = title
        existing.vendor = vendor
        existing.status = status
        if cost is not None:
            existing.cost = cost
        if shopify_variant_id is not None:
            existing.shopify_variant_id = shopify_variant_id
        db.commit()
        db.refresh(existing)
        return existing

    product = Product(
        store_id=store_id,
        shopify_product_id=shopify_product_id,
        shopify_variant_id=shopify_variant_id,
        title=title,
        vendor=vendor,
        status=status,
        cost=cost,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update_product(db: Session, product_id: int, title: str = None, vendor: str = None, status: str = None, cost: float = None, shopify_variant_id: str = None):
    product = get_product(db, product_id)
    if not product:
        return None

    if title is not None:
        product.title = title
    if vendor is not None:
        product.vendor = vendor
    if status is not None:
        product.status = status
    if cost is not None:
        product.cost = cost
    if shopify_variant_id is not None:
        product.shopify_variant_id = shopify_variant_id

    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: int):
    product = get_product(db, product_id)
    if not product:
        return False

    db.delete(product)
    db.commit()
    return True
