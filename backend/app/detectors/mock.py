"""
Mock Deepfake Detector.
Provides deterministic, fast model substitutes for unit and integration testing
without requiring large ML checkpoints.
Never presented as real ML performance.
"""

import time
import numpy as np

from app.core.constants import SignalAvailability
from app.detectors.base import DeepfakeDetector
from app.schemas.detection import DeepfakeResult


class MockDeepfakeDetector(DeepfakeDetector):
    """Deterministic simulation detector for testing and CI pipelines."""

    def __init__(self, model_name: str = "mock-wav2vec2", model_version: str = "v1.2.0-mock"):
        self.model_name = model_name
        self.model_version = model_version
        self.is_loaded = False

    def load_model(self, device: str = "cpu") -> None:
        self.is_loaded = True

    async def predict(self, audio: np.ndarray, sample_rate: int = 16000) -> DeepfakeResult:
        start_t = time.perf_counter()

        if len(audio) == 0:
            return DeepfakeResult(
                score=0.0,
                label="AUTHENTIC",
                confidence=0.0,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=0.5,
                features={"note": "Empty audio buffer"},
            )

        # Generate deterministic synthetic score based on audio signal properties
        # For testing, signals with high high-frequency energy simulate synthetic artifacts
        fft = np.abs(np.fft.rfft(audio))
        hf_ratio = float(np.sum(fft[len(fft) // 2 :]) / (np.sum(fft) + 1e-9))
        score = float(np.clip(hf_ratio * 120.0, 0.0, 95.0))
        label = "SYNTHETIC" if score >= 50.0 else "AUTHENTIC"
        confidence = float(np.clip(abs(score - 50.0) / 50.0 + 0.5, 0.5, 0.99))

        elapsed_ms = (time.perf_counter() - start_t) * 1000.0

        return DeepfakeResult(
            score=round(score, 2),
            label=label,
            confidence=round(confidence, 3),
            signal_availability=SignalAvailability.AVAILABLE,
            model_name=self.model_name,
            model_version=self.model_version,
            inference_time_ms=round(elapsed_ms, 2),
            features={"hf_energy_ratio": round(hf_ratio, 4)},
        )

    def get_model_name(self) -> str:
        return self.model_name

    def get_model_version(self) -> str:
        return self.model_version
