"""
================================================================================
TEST-ONLY FIXTURE — NOT FOR PRODUCTION USE
================================================================================
Deterministic Mock Speaker Verifier for unit tests, CI test matrices, and local
mock environments without downloading multi-gigabyte SpeechBrain weights.

PRODUCTION INVARIANT:
In live production deployments ('TRUEVOICE_ML_MODE=live'), this mock fixture is
strictly disabled. Production code uses ECAPASpeakerVerifier and fails gracefully
with ModelUnavailableError when weights are missing.
"""

import time
import logging
from typing import List, Optional
import numpy as np

from app.config import get_settings
from app.core.constants import SignalAvailability
from app.core.exceptions import AudioProcessingError
from app.schemas.speaker import VerificationResult, SpeakerVerificationResult
from app.speaker.base import SpeakerVerifier

logger = logging.getLogger(__name__)


class MockSpeakerVerifier(SpeakerVerifier):
    """
    TEST-ONLY FIXTURE: Deterministic mock speaker verifier simulating ECAPA-TDNN.
    Generates deterministic 192-dimensional unit vectors derived from audio FFT.
    """

    def __init__(self, model_version: str = "ecapa-tdnn-mock-v1.0"):
        self.model_version = model_version
        self.model_name = "ecapa-tdnn-mock"
        self.is_loaded = False

    def load_model(self, device: str = "cpu") -> None:
        """Simulate loading model weights in test fixture."""
        self.is_loaded = True
        logger.debug("[TEST FIXTURE] MockSpeakerVerifier loaded successfully.")

    def _generate_embedding(self, audio: np.ndarray) -> np.ndarray:
        """Generate deterministic 192-d unit-normalized vector from audio FFT."""
        if len(audio) == 0:
            raise AudioProcessingError("Cannot extract embedding from empty audio in test fixture.")

        # Deterministic feature extraction via FFT magnitude spectrum
        fft = np.abs(np.fft.rfft(audio[:min(len(audio), 4000)]))
        seed_vals = np.resize(fft, 192).astype(np.float32)
        norm = float(np.linalg.norm(seed_vals)) + 1e-9
        return (seed_vals / norm).astype(np.float32)

    async def enroll(self, audio_samples: List[np.ndarray], sample_rate: int = 16000) -> np.ndarray:
        """Generate normalized 192-d centroid across test audio samples."""
        if not audio_samples:
            raise AudioProcessingError("At least one audio sample required for enrollment.")

        valid_samples = [s for s in audio_samples if s is not None and len(s) > 0]
        if not valid_samples:
            raise AudioProcessingError("All provided audio samples are empty.")

        embeddings = [self._generate_embedding(sample) for sample in valid_samples]
        centroid = np.mean(embeddings, axis=0)
        norm = float(np.linalg.norm(centroid)) + 1e-9
        return (centroid / norm).astype(np.float32)

    async def verify(
        self,
        audio: np.ndarray,
        enrolled_embedding: Optional[np.ndarray],
        sample_rate: int = 16000,
        threshold: Optional[float] = None,
    ) -> VerificationResult:
        """Simulate speaker verification with configurable threshold."""
        start_t = time.perf_counter()
        settings = get_settings()
        active_threshold = threshold if threshold is not None else settings.TRUEVOICE_SPEAKER_THRESHOLD

        if enrolled_embedding is None:
            return VerificationResult(
                verified=None,
                similarity=None,
                threshold=active_threshold,
                confidence=0.0,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=0.5,
                distance=1.0,
                is_match=False,
            )

        if audio is None or len(audio) == 0:
            return VerificationResult(
                verified=None,
                similarity=None,
                threshold=active_threshold,
                confidence=0.0,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=0.5,
                distance=1.0,
                is_match=False,
            )

        live_embedding = self._generate_embedding(audio)
        enrolled_clean = np.asarray(enrolled_embedding, dtype=np.float32)
        enr_norm = float(np.linalg.norm(enrolled_clean)) + 1e-9
        enrolled_unit = enrolled_clean / enr_norm

        cosine_sim = float(np.dot(live_embedding, enrolled_unit))
        cosine_sim = float(np.clip(cosine_sim, -1.0, 1.0))
        similarity = float(np.clip((cosine_sim + 1.0) / 2.0, 0.0, 1.0))
        is_verified = bool(similarity >= active_threshold)
        distance = float(np.clip(1.0 - similarity, 0.0, 1.0))

        margin = abs(similarity - active_threshold)
        confidence = float(np.clip(0.5 + margin, 0.5, 0.99))
        elapsed_ms = (time.perf_counter() - start_t) * 1000.0

        return VerificationResult(
            verified=is_verified,
            similarity=round(similarity, 4),
            threshold=active_threshold,
            confidence=round(confidence, 3),
            signal_availability=SignalAvailability.AVAILABLE,
            model_name=self.model_name,
            model_version=self.model_version,
            inference_time_ms=round(elapsed_ms, 2),
            distance=round(distance, 4),
            is_match=is_verified,
        )

    def get_model_version(self) -> str:
        return self.model_version
