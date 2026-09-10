import logging
import smtplib
from email.message import EmailMessage

import requests
from sqlalchemy.orm import Session

from app.core.config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_FROM,
)
from app.database.notification_models import Notification
from app.database.store_model import Store

logger = logging.getLogger(__name__)


def create_notification(
    db: Session,
    store_id: int,
    type: str,
    title: str,
    message: str,
    severity: str = "info",
    payload: dict | None = None,
) -> Notification:
    notification = Notification(
        store_id=store_id,
        type=type,
        severity=severity,
        title=title,
        message=message,
        payload=payload,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def list_notifications(
    db: Session,
    store_id: int,
    unread_only: bool = False,
    limit: int = 100,
):
    query = db.query(Notification).filter(Notification.store_id == store_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    return (
        query.order_by(Notification.created_at.desc()).limit(limit).all()
    )


def unread_count(db: Session, store_id: int) -> int:
    return (
        db.query(Notification)
        .filter(
            Notification.store_id == store_id,
            Notification.is_read == False,  # noqa: E712
        )
        .count()
    )


def mark_read(db: Session, notification_id: int, store_id: int):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.store_id == store_id,
        )
        .first()
    )
    if not notification:
        return None
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


def deliver_notification(notification: Notification, store: Store) -> dict:
    delivered = {"email": False, "webhook": False}
    if store.notification_webhook_url:
        try:
            requests.post(
                store.notification_webhook_url,
                json={
                    "type": notification.type,
                    "severity": notification.severity,
                    "title": notification.title,
                    "message": notification.message,
                    "payload": notification.payload,
                    "created_at": notification.created_at.isoformat()
                    if notification.created_at
                    else None,
                },
                timeout=10,
            )
            delivered["webhook"] = True
        except Exception as e:
            logger.warning(f"Webhook notification delivery failed: {e}")
    if store.notification_email and SMTP_HOST:
        delivered["email"] = _send_email(
            store.notification_email, notification
        )
    return delivered


def deliver_pending(db: Session, store_id: int) -> dict:
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        return {"count": 0, "results": []}

    notifications = (
        db.query(Notification)
        .filter(Notification.store_id == store_id)
        .limit(50)
        .all()
    )
    results = [deliver_notification(n, store) for n in notifications]
    return {"count": len(notifications), "results": results}


def _send_email(to_email: str, notification: Notification) -> bool:
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASSWORD]):
        logger.info("SMTP not configured; skipping email delivery")
        return False

    msg = EmailMessage()
    msg["Subject"] = f"[AutoDrop AI] {notification.title}"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.set_content(notification.message)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        logger.warning(f"Failed to send email notification: {e}")
        return False