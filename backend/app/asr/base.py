"""
Abstract Base Class for TrueVoice Speech Recognition (ASR).
"""

from abc import ABC, abstractmethod
from typing import List, Optional
import numpy as np
from pydantic import BaseModel

from app.core.constants import SignalAvailability


class ASRResult(BaseModel):
    """Standardized output from ASR engine."""
    transcript: str
    confidence: float
    token_log_probs: List[float]
    signal_availability: SignalAvailability
    language: str
    duration_seconds: float
    model_name: str
    model_version: str


class SpeechRecognizer(ABC):
    """Abstract interface for streaming ASR engines."""

    @abstractmethod
    def load_model(self, device: str = "cpu") -> None:
        """Initialize resident ASR model."""
        pass

    @abstractmethod
    async def transcribe(self, audio: np.ndarray, sample_rate: int = 16000) -> ASRResult:
        """Transcribe ML-normalized 16kHz audio chunk."""
        pass

    @abstractmethod
    def get_model_version(self) -> str:
        """Return model version tag."""
        pass
