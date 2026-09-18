from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID
from pydantic import BaseModel, ConfigDict


from app.core.constants import AuditEventType, TrustState


class AuditLogResponse(BaseModel):
    id: Union[UUID, str]
    session_id: Union[UUID, str]
    sequence_id: int
    event_type: AuditEventType
    prev_event_hash: str
    event_hash: str
    trust_state: TrustState
    payload_json: Dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)




class AuditChainValidationResult(BaseModel):
    session_id: str
    total_events: int
    is_valid: bool
    verified_at: datetime
    tampered_at_sequence: Optional[int] = None
    message: str
