from pydantic import BaseModel, Field
from datetime import datetime
from typing import Any


class RuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    rule_type: str = Field(pattern="^(auto_fulfill|repricing|low_stock)$")
    config: dict[str, Any] = {}
    enabled: bool = True


class RuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    config: dict[str, Any] | None = None
    enabled: bool | None = None


class RuleResponse(BaseModel):
    id: int
    store_id: int
    name: str
    rule_type: str
    config: dict[str, Any]
    enabled: bool
    last_run_at: datetime | None = None
    last_status: str | None = None
    last_count: int | None = None
    last_error: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RunResponse(BaseModel):
    id: int
    rule_id: int
    status: str
    summary: str | None = None
    error: str | None = None
    ran_at: datetime

    model_config = {"from_attributes": True}


class RuleRunResult(BaseModel):
    status: str
    count: int
    error: str | None = None
    summary: str | None = None
    last_run_at: datetime | None = None
    run: RunResponse