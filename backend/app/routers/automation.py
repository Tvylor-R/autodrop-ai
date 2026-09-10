from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import User
from app.database.store_model import Store
from app.core.dependencies import get_current_user, get_user_store
from app.schemas.automation import (
    RuleCreate,
    RuleUpdate,
    RuleResponse,
    RunResponse,
    RuleRunResult,
)
from app.services import automation_service


router = APIRouter(
    prefix="/automation",
    tags=["Automation"]
)


def _get_store(db: Session, user: User, shop: str) -> Store:
    return get_user_store(db, user, shop)


def _get_owned_rule(db: Session, rule_id: int, store_id: int):
    rule = automation_service.get_rule(db, rule_id, store_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.get("/rules", response_model=list[RuleResponse])
def list_rules(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, current_user, shop)
    return automation_service.get_rules(db, store.id)


@router.post("/rules", response_model=RuleResponse, status_code=201)
def create_rule(
    shop: str,
    payload: RuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, current_user, shop)
    return automation_service.create_rule(
        db,
        store.id,
        name=payload.name,
        rule_type=payload.rule_type,
        config=payload.config,
        enabled=payload.enabled,
    )


@router.put("/rules/{rule_id}", response_model=RuleResponse)
def update_rule(
    shop: str,
    rule_id: int,
    payload: RuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, current_user, shop)
    rule = _get_owned_rule(db, rule_id, store.id)
    return automation_service.update_rule(
        db,
        rule,
        name=payload.name,
        config=payload.config,
        enabled=payload.enabled,
    )


@router.post("/rules/{rule_id}/toggle", response_model=RuleResponse)
def toggle_rule(
    shop: str,
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, current_user, shop)
    rule = _get_owned_rule(db, rule_id, store.id)
    return automation_service.update_rule(
        db, rule, enabled=not rule.enabled
    )


@router.post("/rules/{rule_id}/run", response_model=RuleRunResult)
def run_rule(
    shop: str,
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, current_user, shop)
    rule = _get_owned_rule(db, rule_id, store.id)
    return automation_service.run_rule_now(db, store, rule)


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    shop: str,
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, current_user, shop)
    rule = _get_owned_rule(db, rule_id, store.id)
    automation_service.delete_rule(db, rule)


@router.get("/runs", response_model=list[RunResponse])
def list_runs(
    shop: str,
    rule_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, current_user, shop)
    return automation_service.get_runs(db, store.id, rule_id=rule_id)