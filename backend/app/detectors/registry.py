"""
Detector Registry & Lifecycle Management.
Initializes and keeps resident ONLY the configured primary deepfake detector at startup.
Avoids loading all three heavy candidate models simultaneously.
"""

from typing import Dict, Optional
from app.config import settings
from app.core.logging import logger
from app.detectors.base import DeepfakeDetector
from app.detectors.mock import MockDeepfakeDetector
from app.detectors.wav2vec2.detector import Wav2Vec2Detector
from app.detectors.rawnet2.detector import RawNet2Detector
from app.detectors.aasist.detector import AASISTDetector


class DetectorRegistry:
    """Central registry managing deepfake detector instance lifecycle."""

    _instance: Optional["DetectorRegistry"] = None
    _active_detector: Optional[DeepfakeDetector] = None

    @classmethod
    def get_registry(cls) -> "DetectorRegistry":
        if cls._instance is None:
            cls._instance = DetectorRegistry()
        return cls._instance

    def initialize_primary_detector(self) -> DeepfakeDetector:
        """
        Resolve and initialize ONLY the configured primary detector.
        Keeps the model resident in worker memory.
        """
        if self._active_detector is not None:
            return self._active_detector

        mode = settings.TRUEVOICE_ML_MODE.lower()
        primary_name = settings.DEEPFAKE_PRIMARY_DETECTOR.lower()

        logger.info(f"Initializing primary deepfake detector: {primary_name} (Mode: {mode})")

        if mode == "mock" or primary_name == "mock":
            self._active_detector = MockDeepfakeDetector()
        elif primary_name == "wav2vec2":
            self._active_detector = Wav2Vec2Detector()
        elif primary_name == "rawnet2":
            self._active_detector = RawNet2Detector()
        elif primary_name == "aasist":
            self._active_detector = AASISTDetector()
        else:
            logger.warning(f"Unknown detector '{primary_name}', falling back to MockDeepfakeDetector")
            self._active_detector = MockDeepfakeDetector()

        # Load weights once at worker startup
        self._active_detector.load_model(device="cpu")
        logger.info(
            f"Primary detector resident in memory: {self._active_detector.get_model_name()} "
            f"({self._active_detector.get_model_version()})"
        )
        return self._active_detector

    def get_active_detector(self) -> DeepfakeDetector:
        """Return the active resident detector."""
        if self._active_detector is None:
            return self.initialize_primary_detector()
        return self._active_detector
