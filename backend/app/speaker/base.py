"""
Abstract Base Class for TrueVoice Speaker Verifiers.
Operates strictly in Branch 2 (Identity Verification).
Never evaluates synthetic audio artifacts.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
import numpy as np

from app.schemas.speaker import VerificationResult


class SpeakerVerifier(ABC):
    """Abstract interface for speaker verification and 192-d embedding extraction."""

    @abstractmethod
    def load_model(self, device: str = "cpu") -> None:
        """Initialize and keep model weights resident in worker memory."""
        pass

    @abstractmethod
    async def enroll(self, audio_samples: List[np.ndarray], sample_rate: int = 16000) -> np.ndarray:
        """
        Extract normalized 192-d centroid embedding vector from enrollment samples.
        Returns: float32 NumPy array of shape (192,) with unit L2 norm.
        """
        pass

    @abstractmethod
    async def verify(
        self,
        audio: np.ndarray,
        enrolled_embedding: Optional[np.ndarray],
        sample_rate: int = 16000,
        threshold: float = 0.75,
    ) -> VerificationResult:
        """
        Extract live embedding and compute normalized geometric similarity against enrolled profile.
        """
        pass

    @abstractmethod
    def get_model_version(self) -> str:
        """Return model version string for audit provenance."""
        pass
