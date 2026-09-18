"""
Pydantic Schemas for Deepfake Detection Results and Signal Availability.
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

from app.core.constants import SignalAvailability


class DeepfakeResult(BaseModel):
    """Standardized output contract for all deepfake detection models."""
    score: float = Field(..., ge=0.0, le=100.0, description="Synthetic voice score (0.0=bona fide, 100.0=synthetic)")
    label: str = Field(..., description="Classification label: 'SYNTHETIC' or 'AUTHENTIC'")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Model prediction confidence")
    signal_availability: SignalAvailability = SignalAvailability.AVAILABLE
    model_name: str
    model_version: str
    inference_time_ms: float
    features: Dict[str, Any] = Field(default_factory=dict)
