"""
Pydantic Schemas for Declarative Policies and Policy Decision Responses.
"""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


from app.core.constants import SecurityActionType, TrustState


class PolicyCreate(BaseModel):
    policy_name: str
    caution_threshold: float = Field(30.0, ge=0.0, le=100.0)
    verify_threshold: float = Field(60.0, ge=0.0, le=100.0)
    block_threshold: float = Field(80.0, ge=0.0, le=100.0)
    enforce_transaction_lock: bool = True
    sensitive_amount_threshold: float = Field(250000.0, ge=0.0)
    oob_timeout_seconds: int = Field(30, ge=5, le=300)
    version: str = "1.0.0"


class PolicyResponse(PolicyCreate):
    id: str
    org_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)



class PolicyDecisionResponse(BaseModel):
    action: SecurityActionType
    reason: str
    target_state: TrustState
    requires_verification: bool
    is_workflow_locked: bool
    policy_version: str
