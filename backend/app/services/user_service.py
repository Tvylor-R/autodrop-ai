from sqlalchemy.orm import Session

from app.database.models import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash, verify_password


def create_user(db: Session, user: UserCreate):
    # Hash the password
    hashed_password = get_password_hash(user.password)

    # Create a new user
    new_user = User(
        full_name=user.full_name,
        email=user.email,
        password_hash=hashed_password
    )

    # Save to the database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)

    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user

