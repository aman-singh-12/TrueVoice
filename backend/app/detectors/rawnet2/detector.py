"""
Canonical RawNet2 Deepfake Detection Adapter (NTU-ROSE Architecture).
Processes raw 16kHz waveforms directly with SincNet convolutional filters,
F-SE residual blocks, and GRU temporal aggregation.
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


class RawNet2Detector(DeepfakeDetector):
    """
    Adapter executing real RawNet2 neural network inference on raw waveforms.
    Compliant with NTU-ROSE ASVspoof 2019 baseline architecture.
    """

    def __init__(self, model_version: str = "rawnet2-v1.0-canonical"):
        self.model_version = model_version
        self.model_name = "rawnet2"
        self.model = None  # RawNet2Model loaded lazily
        self.device = "cpu"
        self.is_loaded = False
        self.checkpoint_path: Optional[str] = None
        self.load_error: Optional[str] = None

    def load_model(self, device: Optional[str] = None) -> None:
        """
        Initialize RawNet2 architecture and load checkpoint weights.
        If no checkpoint is configured or file is missing, marks detector UNAVAILABLE.
        """
        self.device = device or DetectorConfig.get_device()
        self.checkpoint_path = DetectorConfig.get_rawnet2_checkpoint()

        try:
            import torch
            from app.detectors.rawnet2.model import RawNet2Model

            # Instantiate canonical model architecture
            model = RawNet2Model()

            if not self.checkpoint_path:
                self.is_loaded = False
                self.load_error = "No checkpoint configured via TRUEVOICE_RAWNET2_MODEL"
                logger.warning(f"RawNet2Detector: {self.load_error}. Model will be marked UNAVAILABLE.")
                return

            if not os.path.isfile(self.checkpoint_path):
                self.is_loaded = False
                self.load_error = f"Checkpoint file not found at '{self.checkpoint_path}'"
                logger.warning(f"RawNet2Detector: {self.load_error}. Model will be marked UNAVAILABLE.")
                return

            logger.info(f"Loading RawNet2 checkpoint from {self.checkpoint_path} onto {self.device}")
            checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
            state_dict = checkpoint.get("state_dict", checkpoint.get("model", checkpoint))
            model.load_state_dict(state_dict, strict=False)
            model.to(self.device)
            model.eval()

            self.model = model
            self.is_loaded = True
            self.load_error = None
            logger.info("RawNet2 model successfully resident in memory.")
        except Exception as e:
            self.is_loaded = False
            self.load_error = str(e)
            logger.error(f"Failed to load RawNet2 model: {e}", exc_info=True)

    def preprocess(self, audio: np.ndarray) -> np.ndarray:
        """
        Model-specific preprocessing for RawNet2:
        1. First-order high-frequency pre-emphasis filter: y[t] = x[t] - 0.97 * x[t-1]
        2. Zero-mean unit-variance normalization.
        """
        if len(audio) == 0:
            return audio.astype(np.float32)

        # Pre-emphasis filter
        pre_emphasized = np.append(audio[0], audio[1:] - 0.97 * audio[:-1])

        # Zero-mean unit-variance
        std = np.std(pre_emphasized)
        if std > 1e-6:
            normalized = (pre_emphasized - np.mean(pre_emphasized)) / std
        else:
            normalized = pre_emphasized - np.mean(pre_emphasized)

        return normalized.astype(np.float32)

    def _infer_sync(self, processed_audio: np.ndarray) -> tuple[float, float]:
        """Synchronous PyTorch inference executed in worker thread."""
        import torch

        # Minimum length padding (RawNet2 expects at least ~8000 samples / 0.5s for deep pooling)
        min_samples = 8000
        if len(processed_audio) < min_samples:
            repeats = int(np.ceil(min_samples / len(processed_audio)))
            processed_audio = np.tile(processed_audio, repeats)[:min_samples]

        tensor = torch.from_numpy(processed_audio).unsqueeze(0).to(self.device)

        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=-1)[0]
            # Index 0 = bona fide (authentic), Index 1 = spoof (synthetic)
            spoof_prob = float(probs[1].item())
            confidence = float(max(probs[0].item(), probs[1].item()))
            return spoof_prob, confidence

    async def predict(self, audio: np.ndarray, sample_rate: int = 16000) -> DeepfakeResult:
        start_t = time.perf_counter()

        # Handle empty or invalid audio input
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

        # If model weights are not loaded, fail cleanly without fabricating scores
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

        # 1. Preprocess waveform
        processed_audio = self.preprocess(audio)

        # 2. Execute PyTorch inference non-blockingly in thread pool
        try:
            spoof_prob, confidence = await asyncio.to_thread(self._infer_sync, processed_audio)
            score = float(np.clip(spoof_prob * 100.0, 0.0, 100.0))
            label = "SYNTHETIC" if score >= 50.0 else "AUTHENTIC"
            availability = SignalAvailability.AVAILABLE
        except Exception as e:
            logger.error(f"RawNet2 inference failure: {e}", exc_info=True)
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
                "pre_emphasis": 0.97,
                "sincnet_channels": 128,
                "checkpoint": self.checkpoint_path or "initialized",
            },
        )

    def get_model_name(self) -> str:
        return self.model_name

    def get_model_version(self) -> str:
        return self.model_version
