"""
Abstract Base Class for TrueVoice Deepfake Detectors.
Guarantees interchangeable deployment of Wav2Vec2, RawNet2, AASIST, and Mock models.
"""

from abc import ABC, abstractmethod
import numpy as np

from app.schemas.detection import DeepfakeResult


class DeepfakeDetector(ABC):
    """Abstract interface for all audio deepfake artifact detectors."""

    @abstractmethod
    def load_model(self, device: str = "cpu") -> None:
        """Initialize and keep model weights resident in worker memory."""
        pass

    @abstractmethod
    async def predict(self, audio: np.ndarray, sample_rate: int = 16000) -> DeepfakeResult:
        """
        Evaluate canonical 16kHz mono audio chunk and return standardized DeepfakeResult.
        Model adapters apply model-specific preprocessing before inference.
        """
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Return model architecture name."""
        pass

    @abstractmethod
    def get_model_version(self) -> str:
        """Return version string for audit provenance."""
        pass
