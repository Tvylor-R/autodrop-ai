from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import User
from app.database.store_model import Store
from app.core.dependencies import get_current_user
from app.schemas.notification import UnreadCountResponse
from app.services import notification_service


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


def _get_store(db: Session, shop: str) -> Store:
    store = db.query(Store).filter(Store.shop_domain == shop).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


@router.get("")
def list_notifications(
    shop: str,
    unread_only: bool = False,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)
    return notification_service.list_notifications(
        db, store.id, unread_only=unread_only, limit=limit
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)
    return {"count": notification_service.unread_count(db, store.id)}


@router.post("/{notification_id}/read")
def mark_read(
    shop: str,
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)
    notification = notification_service.mark_read(
        db, notification_id, store.id
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.post("/deliver")
def deliver(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)
    return notification_service.deliver_pending(db, store.id)