"""
Pydantic Schemas for Out-of-Band Secondary Verification and Challenges.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.core.constants import ChallengeStatus, ChallengeType


class ChallengeDispatch(BaseModel):
    session_id: str
    challenge_type: ChallengeType = ChallengeType.OOB_PUSH


class ChallengeResponse(BaseModel):
    challenge_token: str
    session_id: str
    challenge_type: ChallengeType
    nonce: str
    expires_at: datetime
    ttl_seconds: int
    instructions: str = "Simulated OOB challenge dispatched to enrolled user device"


class VerificationSubmit(BaseModel):
    challenge_token: str
    nonce: str
    signature: str  # Simulated biometric authorization HMAC/token


class VerificationResultSummary(BaseModel):
    session_id: str
    status: ChallengeStatus
    message: str
    verified_at: Optional[datetime] = None
