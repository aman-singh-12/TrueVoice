"""
Abstract Base Class for TrueVoice Speech Recognition (ASR).
Operates in Branch 2 to extract conversational transcripts and phonetic confidence.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
import numpy as np
from pydantic import BaseModel, Field

from app.core.constants import SignalAvailability


class ASRResult(BaseModel):
    """Standardized output from ASR engine."""
    transcript: str = ""
    confidence: float = Field(0.0, ge=0.0, le=1.0, description="Confidence score in [0.0, 1.0]")
    token_log_probs: List[float] = Field(default_factory=list, description="Per-token log probabilities")
    signal_availability: SignalAvailability = SignalAvailability.AVAILABLE
    language: str = "en"
    duration_seconds: float = 0.0
    inference_time_ms: float = 0.0
    model_name: str
    model_version: str


class SpeechRecognizer(ABC):
    """Abstract interface for streaming ASR engines."""

    @abstractmethod
    def load_model(self, device: str = "cpu") -> None:
        """Initialize resident ASR model."""
        pass

    @abstractmethod
    async def transcribe(
        self,
        audio: np.ndarray,
        sample_rate: int = 16000,
        language: Optional[str] = None,
    ) -> ASRResult:
        """
        Transcribe ML-normalized 16kHz audio chunk.
        Supports optional language override (e.g. 'en', 'hi', 'pa') or auto-detection.
        """
        pass

    @abstractmethod
    def get_model_version(self) -> str:
        """Return model version tag."""
        pass
