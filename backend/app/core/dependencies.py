from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import SECRET_KEY, ALGORITHM
from app.database.database import SessionLocal
from app.database.models import User
from app.database.store_model import Store
from app.services.user_service import get_user_by_email

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        email = payload.get("sub")

        if email is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = get_user_by_email(db, email)

    if user is None:
        raise credentials_exception

    return user


def get_user_store(
    db: Session,
    user: User,
    shop: str,
):
    """Store lookup scoped to the user.

    A store is accessible if it has no owner (unclaimed/legacy) or is
    owned by the requesting user. Once claimed, it is private to its owner.
    """
    store = (
        db.query(Store)
        .filter(
            Store.shop_domain == shop,
            or_(Store.user_id == user.id, Store.user_id.is_(None)),
        )
        .first()
    )
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store