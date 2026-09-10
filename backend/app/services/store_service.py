from sqlalchemy.orm import Session
from app.database.store_model import Store


def get_store(db: Session, shop: str):
    return (
        db.query(Store)
        .filter(Store.shop_domain == shop)
        .first()
    )


def save_store(db: Session, shop: str, access_token: str):
    existing = (
        db.query(Store)
        .filter(Store.shop_domain == shop)
        .first()
    )

    if existing:
        existing.access_token = access_token
        db.commit()
        db.refresh(existing)
        return existing

    new_store = Store(
        shop_domain=shop,
        access_token=access_token
    )

    db.add(new_store)
    db.commit()
    db.refresh(new_store)

    return new_store
