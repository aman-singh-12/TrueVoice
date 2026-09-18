"""
Mock Speaker Verifier.
Provides deterministic, fast 192-dimensional embeddings and geometric similarity
for testing and CI pipelines without downloading SpeechBrain weights.
"""

import time
from typing import List, Optional
import numpy as np

from app.core.constants import SignalAvailability
from app.schemas.speaker import VerificationResult
from app.speaker.base import SpeakerVerifier


class MockSpeakerVerifier(SpeakerVerifier):
    """Deterministic mock speaker verifier simulating ECAPA-TDNN."""

    def __init__(self, model_version: str = "ecapa-tdnn-mock-v1.0"):
        self.model_version = model_version
        self.model_name = "ecapa-tdnn"
        self.is_loaded = False

    def load_model(self, device: str = "cpu") -> None:
        self.is_loaded = True

    def _generate_embedding(self, audio: np.ndarray) -> np.ndarray:
        """Generate deterministic 192-d unit-normalized vector from audio."""
        if len(audio) == 0:
            vec = np.zeros(192, dtype=np.float32)
            vec[0] = 1.0
            return vec

        # Use FFT bin energy as deterministic seed
        fft = np.abs(np.fft.rfft(audio[:min(len(audio), 4000)]))
        seed_vals = np.resize(fft, 192).astype(np.float32)
        norm = np.linalg.norm(seed_vals) + 1e-9
        return (seed_vals / norm).astype(np.float32)

    async def enroll(self, audio_samples: List[np.ndarray], sample_rate: int = 16000) -> np.ndarray:
        if not audio_samples:
            vec = np.zeros(192, dtype=np.float32)
            vec[0] = 1.0
            return vec

        embeddings = [self._generate_embedding(sample) for sample in audio_samples]
        centroid = np.mean(embeddings, axis=0)
        norm = np.linalg.norm(centroid) + 1e-9
        return (centroid / norm).astype(np.float32)

    async def verify(
        self,
        audio: np.ndarray,
        enrolled_embedding: Optional[np.ndarray],
        sample_rate: int = 16000,
        threshold: float = 0.75,
    ) -> VerificationResult:
        start_t = time.perf_counter()

        if enrolled_embedding is None:
            return VerificationResult(
                verified=None,
                similarity=0.0,
                threshold=threshold,
                confidence=0.0,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=0.5,
            )

        if len(audio) == 0:
            return VerificationResult(
                verified=None,
                similarity=0.0,
                threshold=threshold,
                confidence=0.0,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=0.5,
            )

        live_embedding = self._generate_embedding(audio)
        cosine_sim = float(np.dot(live_embedding, enrolled_embedding))
        # Normalized geometric similarity transformation in [0.0, 1.0]
        similarity = float(np.clip((cosine_sim + 1.0) / 2.0, 0.0, 1.0))
        is_verified = bool(similarity >= threshold)

        elapsed_ms = (time.perf_counter() - start_t) * 1000.0

        return VerificationResult(
            verified=is_verified,
            similarity=round(similarity, 4),
            threshold=threshold,
            confidence=0.92,
            signal_availability=SignalAvailability.AVAILABLE,
            model_name=self.model_name,
            model_version=self.model_version,
            inference_time_ms=round(elapsed_ms, 2),
        )

    def get_model_version(self) -> str:
        return self.model_version
