"""
Multi-Model Deepfake Ensemble Detector.
Coordinates inference across Wav2Vec2, RawNet2, and AASIST.
Preserves component scores and availability transparency without falsely claiming
empirical statistical calibration when uncalibrated.
"""

import asyncio
import time
from typing import Dict, List, Optional
import numpy as np

from app.core.constants import SignalAvailability
from app.core.logging import logger
from app.detectors.aasist.detector import AASISTDetector
from app.detectors.base import DeepfakeDetector
from app.detectors.rawnet2.detector import RawNet2Detector
from app.detectors.wav2vec2.detector import Wav2Vec2Detector
from app.schemas.detection import DeepfakeResult


class EnsembleDetector(DeepfakeDetector):
    """
    Multi-model ensemble executing Wav2Vec2, RawNet2, and AASIST.
    Handles component unavailability gracefully and reports individual scores.
    """

    def __init__(
        self,
        model_version: str = "ensemble-v1.0",
        detectors: Optional[Dict[str, DeepfakeDetector]] = None,
        weights: Optional[Dict[str, float]] = None,
    ):
        self.model_version = model_version
        self.model_name = "ensemble"
        self.detectors = detectors or {
            "wav2vec2": Wav2Vec2Detector(),
            "rawnet2": RawNet2Detector(),
            "aasist": AASISTDetector(),
        }
        # Baseline component weights (normalized dynamically across available models)
        self.default_weights = weights or {
            "wav2vec2": 0.40,
            "rawnet2": 0.30,
            "aasist": 0.30,
        }
        self.device = "cpu"
        self.is_loaded = False

    def load_model(self, device: str = "cpu") -> None:
        """Initialize all candidate models in the ensemble."""
        self.device = device
        loaded_count = 0
        for name, detector in self.detectors.items():
            try:
                detector.load_model(device=device)
                if getattr(detector, "is_loaded", False):
                    loaded_count += 1
            except Exception as e:
                logger.warning(f"Ensemble: Failed to load member model '{name}': {e}")

        self.is_loaded = loaded_count > 0
        logger.info(f"Ensemble initialized ({loaded_count}/{len(self.detectors)} member models resident).")

    async def predict(self, audio: np.ndarray, sample_rate: int = 16000) -> DeepfakeResult:
        start_t = time.perf_counter()

        if len(audio) == 0:
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            return DeepfakeResult(
                score=0.0,
                label="AUTHENTIC",
                confidence=None,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=round(elapsed_ms, 2),
                features={"error": "Empty audio buffer"},
            )

        # Run member detectors concurrently
        tasks = [
            detector.predict(audio, sample_rate=sample_rate)
            for detector in self.detectors.values()
        ]
        results: List[DeepfakeResult] = await asyncio.gather(*tasks, return_exceptions=False)

        component_scores: Dict[str, Optional[float]] = {}
        component_availabilities: Dict[str, str] = {}
        component_confidences: Dict[str, Optional[float]] = {}

        available_scores: List[float] = []
        available_weights: List[float] = []
        available_confidences: List[float] = []
        available_models: List[str] = []

        for name, result in zip(self.detectors.keys(), results):
            is_avail = result.signal_availability == SignalAvailability.AVAILABLE
            component_availabilities[name] = result.signal_availability.value
            component_confidences[name] = result.confidence

            if is_avail:
                component_scores[name] = result.score
                available_scores.append(result.score)
                base_w = self.default_weights.get(name, 1.0)
                # Modulate weight by model confidence if provided
                conf_factor = result.confidence if result.confidence is not None else 1.0
                available_weights.append(base_w * conf_factor)
                if result.confidence is not None:
                    available_confidences.append(result.confidence)
                available_models.append(name)
            else:
                component_scores[name] = None

        elapsed_ms = (time.perf_counter() - start_t) * 1000.0

        # If zero member models are available, mark ensemble UNAVAILABLE
        if not available_scores:
            return DeepfakeResult(
                score=0.0,
                label="AUTHENTIC",
                confidence=None,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=round(elapsed_ms, 2),
                features={
                    "error": "No ensemble member models available",
                    "component_scores": component_scores,
                    "component_availability": component_availabilities,
                    "calibrated": False,
                },
            )

        # Weighted score aggregation across available models
        total_weight = sum(available_weights)
        if total_weight > 0:
            aggregated_score = sum(s * w for s, w in zip(available_scores, available_weights)) / total_weight
        else:
            aggregated_score = float(np.mean(available_scores))

        aggregated_score = float(np.clip(aggregated_score, 0.0, 100.0))
        label = "SYNTHETIC" if aggregated_score >= 50.0 else "AUTHENTIC"
        mean_confidence = float(np.mean(available_confidences)) if available_confidences else 0.75

        return DeepfakeResult(
            score=round(aggregated_score, 2),
            label=label,
            confidence=round(mean_confidence, 3),
            signal_availability=SignalAvailability.AVAILABLE,
            model_name=self.model_name,
            model_version=self.model_version,
            inference_time_ms=round(elapsed_ms, 2),
            features={
                "component_scores": component_scores,
                "component_availability": component_availabilities,
                "component_confidences": component_confidences,
                "available_models": available_models,
                "calibrated": False,
                "aggregation_method": "confidence_weighted_linear",
            },
        )

    def get_model_name(self) -> str:
        return self.model_name

    def get_model_version(self) -> str:
        return self.model_version
