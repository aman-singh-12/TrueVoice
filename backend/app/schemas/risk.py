"""
Pydantic Schemas for Multi-Signal Risk Assessments, Provenance, and Telemetry Broadcasts.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


from app.core.constants import RiskTier, SecurityActionType, SignalAvailability, TrustState


class SignalEvidence(BaseModel):
    """Provenance and measurement record for an individual signal."""
    score: float
    signal_availability: SignalAvailability
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    weight_applied: float = 0.0
    features: Dict[str, Any] = Field(default_factory=dict)


class RiskAssessmentResponse(BaseModel):
    id: str
    session_id: str
    sequence_id: int
    synthetic_prob: float
    speaker_similarity: Optional[float]
    forensic_score: float
    conversational_score: float
    composite_risk: float
    risk_tier: RiskTier
    primary_factors: List[str]
    evidence_provenance: Dict[str, Any]
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)



class RiskTelemetryBroadcast(BaseModel):
    """Real-time JSON event payload streamed over WebSocket to analyst console."""
    type: str = "TELEMETRY"
    session_id: str
    sequence_id: int
    timestamp: str
    risk_score: float
    risk_tier: RiskTier
    trust_state: TrustState
    breakdown: Dict[str, float]
    provenance: Dict[str, Any]
    security_action: SecurityActionType
    detected_intents: List[str]
    transcript_snippet: Optional[str] = None
