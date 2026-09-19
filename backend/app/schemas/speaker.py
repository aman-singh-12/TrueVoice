"""
Pydantic Schemas for Speaker Verification, Enrollment, and Results.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import SignalAvailability


class SpeakerEnrollRequest(BaseModel):
    display_name: str
    designation: str
    user_id: Optional[str] = None


class SpeakerResponse(BaseModel):
    id: str
    org_id: str
    display_name: str
    designation: str
    is_active: bool
    created_at: datetime
    has_enrolled_voiceprint: bool = False

    model_config = ConfigDict(from_attributes=True)


SpeakerProfileResponse = SpeakerResponse


class VoiceprintResponse(BaseModel):
    id: str
    speaker_profile_id: str
    quality_score: float
    sample_duration_seconds: float
    enrolled_at: datetime

    model_config = ConfigDict(from_attributes=True)




class VerificationResult(BaseModel):
    """
    Standardized output contract for speaker verification.
    Represents the mathematical evaluation of live audio against an enrolled 192-d centroid.
    """
    verified: Optional[bool] = None  # None if unverified/unenrolled or model unavailable
    similarity: Optional[float] = Field(None, ge=0.0, le=1.0, description="Normalized geometric similarity [0.0, 1.0]")
    threshold: float = Field(0.75, ge=0.0, le=1.0, description="Configured verification threshold operating point")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score for biometric prediction")
    signal_availability: SignalAvailability = SignalAvailability.AVAILABLE
    model_name: str = "ecapa-tdnn"
    model_version: str = "speechbrain-ecapa-voxceleb"
    inference_time_ms: float = 0.0
    distance: Optional[float] = None
    is_match: Optional[bool] = None


# Explicit alias matching architectural nomenclature
SpeakerVerificationResult = VerificationResult
