from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text
from datetime import datetime

from app.database.database import Base


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), index=True)
    name = Column(String(120), nullable=False)
    rule_type = Column(String(50), nullable=False)
    config = Column(JSON, default=dict)
    enabled = Column(Boolean, default=True)
    last_run_at = Column(DateTime)
    last_status = Column(String(20))
    last_count = Column(Integer)
    last_error = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class AutomationRun(Base):
    __tablename__ = "automation_runs"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("automation_rules.id"), index=True)
    status = Column(String(20), nullable=False)
    summary = Column(String(255))
    error = Column(Text)
    ran_at = Column(DateTime, default=datetime.utcnow, index=True)