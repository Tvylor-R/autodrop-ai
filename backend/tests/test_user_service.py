from app.services.user_service import (
    create_user,
    get_user_by_email,
    authenticate_user,
)
from app.schemas.user import UserCreate


def test_create_user(db_session):
    user_data = UserCreate(
        full_name="John Doe",
        email="john@example.com",
        password="securepass123",
    )
    user = create_user(db_session, user_data)

    assert user.full_name == "John Doe"
    assert user.email == "john@example.com"
    assert user.password_hash != "securepass123"


def test_get_user_by_email(db_session, sample_user):
    user = get_user_by_email(db_session, "test@example.com")
    assert user is not None
    assert user.email == "test@example.com"


def test_get_user_by_email_not_found(db_session):
    user = get_user_by_email(db_session, "nonexistent@example.com")
    assert user is None


def test_authenticate_user_correct_password(db_session, sample_user):
    user = authenticate_user(db_session, "test@example.com", "testpass123")
    assert user is not None
    assert user.email == "test@example.com"


def test_authenticate_user_wrong_password(db_session, sample_user):
    user = authenticate_user(db_session, "test@example.com", "wrongpass")
    assert user is None


def test_create_duplicate_user_raises(db_session):
    from sqlalchemy.exc import IntegrityError

    user_data = UserCreate(full_name="A", email="dup@example.com", password="pass123")
    user_data2 = UserCreate(full_name="B", email="dup@example.com", password="pass456")

    create_user(db_session, user_data)

    try:
        create_user(db_session, user_data2)
        assert False, "Should have raised IntegrityError"
    except IntegrityError:
        pass