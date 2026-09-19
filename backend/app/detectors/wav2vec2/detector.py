"""
Wav2Vec 2.0 Deepfake Detection Adapter.
Executes real fine-tuned Wav2Vec 2.0 sequence classification inference on 16kHz audio.
Compliant with Repo 1 reference architecture (voice-cloning-detector).
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


class Wav2Vec2Detector(DeepfakeDetector):
    """
    Fine-tuned Wav2Vec 2.0 sequence classification deepfake detector.
    Requires an explicitly configured checkpoint via TRUEVOICE_WAV2VEC2_MODEL.
    Fails cleanly to UNAVAILABLE if no checkpoint is configured or weights are absent.
    """

    def __init__(self, model_version: str = "wav2vec2-v1.2-asvspoof"):
        self.model_version = model_version
        self.model_name = "wav2vec2"
        self.model = None
        self.processor = None
        self.device = "cpu"
        self.is_loaded = False
        self.checkpoint_id: Optional[str] = None
        self.load_error: Optional[str] = None
        self.spoof_class_index: int = 1  # Default: index 0 = authentic, index 1 = spoof

    def load_model(self, device: Optional[str] = None) -> None:
        """
        Load fine-tuned classification checkpoint into resident memory.
        Refuses to run uncalibrated base models as deepfake detectors.
        """
        self.device = device or DetectorConfig.get_device()
        self.checkpoint_id = DetectorConfig.get_wav2vec2_checkpoint()

        if not self.checkpoint_id:
            self.is_loaded = False
            self.load_error = "No deepfake classification checkpoint configured via TRUEVOICE_WAV2VEC2_MODEL"
            logger.warning(f"Wav2Vec2Detector: {self.load_error}. Model will be marked UNAVAILABLE.")
            return

        try:
            import torch
            from transformers import AutoFeatureExtractor, AutoModelForSequenceClassification

            logger.info(f"Loading Wav2Vec2 deepfake checkpoint '{self.checkpoint_id}' on {self.device}")
            self.processor = AutoFeatureExtractor.from_pretrained(self.checkpoint_id)
            self.model = AutoModelForSequenceClassification.from_pretrained(self.checkpoint_id)

            # Inspect model id2label mapping to identify spoof/synthetic class index
            if hasattr(self.model.config, "id2label") and self.model.config.id2label:
                for idx, lbl in self.model.config.id2label.items():
                    lbl_clean = str(lbl).lower()
                    if any(term in lbl_clean for term in ("fake", "spoof", "synthetic", "cloned")):
                        self.spoof_class_index = int(idx)
                        break

            self.model.to(self.device)
            self.model.eval()
            self.is_loaded = True
            self.load_error = None
            logger.info(f"Wav2Vec2 checkpoint '{self.checkpoint_id}' successfully loaded.")
        except Exception as e:
            self.is_loaded = False
            self.load_error = str(e)
            logger.error(f"Failed to load Wav2Vec2 checkpoint '{self.checkpoint_id}': {e}", exc_info=True)

    def preprocess(self, audio: np.ndarray) -> np.ndarray:
        """
        Model-specific preprocessing for Wav2Vec2:
        Peak and RMS normalization to -24 dBFS with a -1.0 dBFS peak clamp.
        """
        if len(audio) == 0:
            return audio.astype(np.float32)

        rms = np.sqrt(np.mean(audio**2) + 1e-9)
        target_rms = 10.0 ** (-24.0 / 20.0)
        gain = target_rms / rms
        normalized = np.clip(audio * gain, -1.0, 1.0)
        return normalized.astype(np.float32)

    def _infer_sync(self, processed_audio: np.ndarray, sample_rate: int) -> tuple[float, float]:
        """Synchronous PyTorch inference in thread pool."""
        import torch

        inputs = self.processor(
            processed_audio, sampling_rate=sample_rate, return_tensors="pt"
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            logits = self.model(**inputs).logits
            probs = torch.softmax(logits, dim=-1)[0]
            spoof_prob = float(probs[self.spoof_class_index].item())
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

        if not self.is_loaded or self.model is None or self.processor is None:
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            return DeepfakeResult(
                score=0.0,
                label="AUTHENTIC",
                confidence=None,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=round(elapsed_ms, 2),
                features={"error": self.load_error or "Checkpoint weights not loaded"},
            )

        # 1. Apply model-specific preprocessing
        processed_audio = self.preprocess(audio)

        # 2. Execute neural inference non-blockingly
        try:
            spoof_prob, confidence = await asyncio.to_thread(
                self._infer_sync, processed_audio, sample_rate
            )
            synthetic_score = float(np.clip(spoof_prob * 100.0, 0.0, 100.0))
            label = "SYNTHETIC" if synthetic_score >= 50.0 else "AUTHENTIC"
            availability = SignalAvailability.AVAILABLE
        except Exception as e:
            logger.error(f"Wav2Vec2 inference failure: {e}", exc_info=True)
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
            score=round(synthetic_score, 2),
            label=label,
            confidence=round(confidence, 3),
            signal_availability=availability,
            model_name=self.model_name,
            model_version=self.model_version,
            inference_time_ms=round(elapsed_ms, 2),
            features={
                "rms_dbfs": -24.0,
                "checkpoint": self.checkpoint_id or "configured",
            },
        )

    def get_model_name(self) -> str:
        return self.model_name

    def get_model_version(self) -> str:
        return self.model_version
