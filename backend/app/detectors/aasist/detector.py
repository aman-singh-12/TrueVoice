"""
AASIST Graph Attention Anti-Spoofing Detection Adapter.
Models spectro-temporal interactions across heterogeneous graph nodes
directly on raw 16kHz waveforms.
Completely removes simulated FFT heuristics from production inference.
"""

import asyncio
import os
import time
from typing import Optional
import numpy as np

from app.core.constants import SignalAvailability
from app.core.logging import logger
from app.detectors.base import DeepfakeDetector
from app.detectors.config import DetectorConfig
from app.schemas.detection import DeepfakeResult


class AASISTDetector(DeepfakeDetector):
    """
    AASIST / AASIST-L heterogeneous graph attention network deepfake detector.
    Compliant with Clova AI reference architecture.
    """

    def __init__(self, model_version: str = "aasist-l-v1.0"):
        self.model_version = model_version
        self.model_name = "aasist"
        self.model = None  # AASISTModel loaded lazily
        self.device = "cpu"
        self.is_loaded = False
        self.checkpoint_path: Optional[str] = None
        self.load_error: Optional[str] = None

    def load_model(self, device: Optional[str] = None) -> None:
        """
        Initialize AASIST model and load checkpoint weights from TRUEVOICE_AASIST_MODEL.
        If no checkpoint is configured or file is missing, marks detector UNAVAILABLE.
        """
        self.device = device or DetectorConfig.get_device()
        self.checkpoint_path = DetectorConfig.get_aasist_checkpoint()

        try:
            import torch
            from app.detectors.aasist.model import AASISTModel

            model = AASISTModel()

            if not self.checkpoint_path:
                self.is_loaded = False
                self.load_error = "No checkpoint configured via TRUEVOICE_AASIST_MODEL"
                logger.warning(f"AASISTDetector: {self.load_error}. Model will be marked UNAVAILABLE.")
                return

            if not os.path.isfile(self.checkpoint_path):
                self.is_loaded = False
                self.load_error = f"Checkpoint file not found at '{self.checkpoint_path}'"
                logger.warning(f"AASISTDetector: {self.load_error}. Model will be marked UNAVAILABLE.")
                return

            logger.info(f"Loading AASIST checkpoint from {self.checkpoint_path} onto {self.device}")
            checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
            state_dict = checkpoint.get("state_dict", checkpoint.get("model", checkpoint))
            model.load_state_dict(state_dict, strict=False)
            model.to(self.device)
            model.eval()

            self.model = model
            self.is_loaded = True
            self.load_error = None
            logger.info("AASIST model successfully resident in memory.")
        except Exception as e:
            self.is_loaded = False
            self.load_error = str(e)
            logger.error(f"Failed to load AASIST model: {e}", exc_info=True)

    def preprocess(self, audio: np.ndarray) -> np.ndarray:
        """
        Model-specific preprocessing for AASIST:
        1. Ensure canonical 16kHz float32 array.
        2. Normalization with peak scaling.
        """
        if len(audio) == 0:
            return audio.astype(np.float32)

        max_val = np.max(np.abs(audio))
        if max_val > 1e-6:
            normalized = audio / max_val
        else:
            normalized = audio

        return normalized.astype(np.float32)

    def _infer_sync(self, processed_audio: np.ndarray) -> tuple[float, float]:
        """Synchronous PyTorch inference executed in worker thread."""
        import torch

        # AASIST receptive field: pad up to at least 16,000 samples (1.0s)
        min_samples = 16000
        if len(processed_audio) < min_samples:
            repeats = int(np.ceil(min_samples / len(processed_audio)))
            processed_audio = np.tile(processed_audio, repeats)[:min_samples]

        tensor = torch.from_numpy(processed_audio).unsqueeze(0).to(self.device)

        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=-1)[0]
            # Index 0 = bona fide, Index 1 = spoof
            spoof_prob = float(probs[1].item())
            confidence = float(max(probs[0].item(), probs[1].item()))
            return spoof_prob, confidence

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

        if not self.is_loaded or self.model is None:
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            return DeepfakeResult(
                score=0.0,
                label="AUTHENTIC",
                confidence=None,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=round(elapsed_ms, 2),
                features={"error": self.load_error or "Model weights not loaded"},
            )

        processed = self.preprocess(audio)

        try:
            spoof_prob, confidence = await asyncio.to_thread(self._infer_sync, processed)
            score = float(np.clip(spoof_prob * 100.0, 0.0, 100.0))
            label = "SYNTHETIC" if score >= 50.0 else "AUTHENTIC"
            availability = SignalAvailability.AVAILABLE
        except Exception as e:
            logger.error(f"AASIST inference failure: {e}", exc_info=True)
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            return DeepfakeResult(
                score=0.0,
                label="AUTHENTIC",
                confidence=None,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=round(elapsed_ms, 2),
                features={"error": str(e)},
            )

        elapsed_ms = (time.perf_counter() - start_t) * 1000.0

        return DeepfakeResult(
            score=round(score, 2),
            label=label,
            confidence=round(confidence, 3),
            signal_availability=availability,
            model_name=self.model_name,
            model_version=self.model_version,
            inference_time_ms=round(elapsed_ms, 2),
            features={
                "graph_attention": "spectro_temporal_heterogeneous",
                "sinc_channels": 70,
                "checkpoint": self.checkpoint_path or "initialized",
            },
        )

    def get_model_name(self) -> str:
        return self.model_name

    def get_model_version(self) -> str:
        return self.model_version
