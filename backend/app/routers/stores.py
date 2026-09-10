from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user, get_user_store
from app.database.models import User
from app.database.store_model import Store

router = APIRouter(
    prefix="/stores",
    tags=["Stores"]
)


# Claim a store: first claimant becomes the owner. Idempotent for the owner.
@router.post("/claim")
def claim_store(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = db.query(Store).filter(Store.shop_domain == shop).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    if store.user_id is not None and store.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Store already claimed by another user")

    store.user_id = current_user.id
    db.commit()
    db.refresh(store)

    return {"shop": store.shop_domain, "claimed": True}


# List stores owned by the current user
@router.get("/mine")
def my_stores(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stores = (
        db.query(Store)
        .filter(Store.user_id == current_user.id)
        .order_by(Store.created_at.desc())
        .all()
    )
    return {
        "stores": [
            {
                "id": s.id,
                "shop_domain": s.shop_domain,
                "connected": bool(s.access_token),
            }
            for s in stores
        ]
    }