from datetime import datetime
from typing import Any, Dict, Optional, Union
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import TrustState


class SessionCreate(BaseModel):
    claimed_speaker_id: Optional[str] = None
    caller_ani: str = Field("UNKNOWN", description="Optional communication-gateway-provided caller ID")
    context_metadata: Dict[str, Any] = Field(default_factory=dict)


class SessionResponse(BaseModel):
    id: Union[UUID, str]
    org_id: Union[UUID, str]
    session_token: str
    claimed_speaker_id: Optional[Union[UUID, str]] = None
    caller_ani: str
    current_trust_state: TrustState
    peak_risk_score: float
    started_at: datetime
    ended_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)




class SessionDetailResponse(SessionResponse):
    context_metadata: Dict[str, Any] = Field(default_factory=dict)
    recent_assessments_count: int = 0


class AnalystOverrideRequest(BaseModel):
    """Analyst review exit command."""
    action: str = Field(..., description="ANALYST_APPROVE, ANALYST_RESTRICT, or ANALYST_BLOCK")
    reason: str = Field(..., min_length=3, description="Audit justification for analyst override")

