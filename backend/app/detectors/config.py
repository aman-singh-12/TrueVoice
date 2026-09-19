"""
Detector-Specific Configuration Layer.
Centralizes checkpoint paths, runtime device resolution, and acoustic thresholds
for Wav2Vec2, RawNet2, AASIST, and Ensemble deepfake detection models.
"""

import os
from typing import Optional
from app.config import settings


class DetectorConfig:
    """Manages detector checkpoint paths, execution device, and thresholds."""

    @classmethod
    def get_device(cls) -> str:
        """Resolve compute device (cpu or cuda) based on config and hardware availability."""
        requested_device = getattr(settings, "TRUEVOICE_ML_DEVICE", None) or os.getenv("TRUEVOICE_ML_DEVICE", "cpu")
        requested_device = requested_device.lower()

        if requested_device.startswith("cuda"):
            try:
                import torch
                if torch.cuda.is_available():
                    return requested_device
            except ImportError:
                pass
            return "cpu"
        return "cpu"

    @classmethod
    def get_wav2vec2_checkpoint(cls) -> Optional[str]:
        """
        Return the configured Wav2Vec2 deepfake classification checkpoint.
        Prioritizes TRUEVOICE_WAV2VEC2_MODEL environment variable or settings.
        Returns None if not explicitly configured.
        """
        return os.getenv("TRUEVOICE_WAV2VEC2_MODEL") or getattr(settings, "TRUEVOICE_WAV2VEC2_MODEL", None)

    @classmethod
    def get_rawnet2_checkpoint(cls) -> Optional[str]:
        """
        Return the configured RawNet2 model checkpoint file path or identifier.
        Prioritizes TRUEVOICE_RAWNET2_MODEL environment variable or settings.
        Returns None if not explicitly configured.
        """
        return os.getenv("TRUEVOICE_RAWNET2_MODEL") or getattr(settings, "TRUEVOICE_RAWNET2_MODEL", None)

    @classmethod
    def get_aasist_checkpoint(cls) -> Optional[str]:
        """
        Return the configured AASIST / AASIST-L checkpoint file path or identifier.
        Prioritizes TRUEVOICE_AASIST_MODEL environment variable or settings.
        Returns None if not explicitly configured.
        """
        return os.getenv("TRUEVOICE_AASIST_MODEL") or getattr(settings, "TRUEVOICE_AASIST_MODEL", None)

    @classmethod
    def is_mock_mode(cls) -> bool:
        """Check if system is explicitly configured for mock/simulation testing mode."""
        mode = os.getenv("TRUEVOICE_ML_MODE", getattr(settings, "TRUEVOICE_ML_MODE", "mock")).lower()
        primary = os.getenv("DEEPFAKE_PRIMARY_DETECTOR", getattr(settings, "DEEPFAKE_PRIMARY_DETECTOR", "mock")).lower()
        return mode == "mock" or primary == "mock"
