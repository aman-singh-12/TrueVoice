"""
================================================================================
TEST-ONLY FIXTURE — NOT FOR PRODUCTION USE
================================================================================
Deterministic Mock Speech Recognizer for unit tests, CI test matrices, and local
mock environments without downloading multi-gigabyte Whisper checkpoints.

PRODUCTION INVARIANT:
In live production deployments ('TRUEVOICE_ML_MODE=live'), this mock fixture is
strictly disabled. Production code uses WhisperSpeechRecognizer and fails gracefully
with SignalAvailability.UNAVAILABLE when models are missing.
"""

import logging
from typing import List, Optional
import numpy as np

from app.asr.base import ASRResult, SpeechRecognizer
from app.core.constants import SignalAvailability

logger = logging.getLogger(__name__)


class MockSpeechRecognizer(SpeechRecognizer):
    """
    TEST-ONLY FIXTURE: Deterministic ASR simulation for CI and tests.
    Generates synthetic transcripts only when audio RMS exceeds energy threshold.
    """

    def __init__(self, model_version: str = "mock-whisper-v1.0"):
        self.model_version = model_version
        self.model_name = "mock-whisper"
        self.is_loaded = False

    def load_model(self, device: str = "cpu") -> None:
        self.is_loaded = True
        logger.debug("[TEST FIXTURE] MockSpeechRecognizer initialized.")

    async def transcribe(
        self,
        audio: np.ndarray,
        sample_rate: int = 16000,
        language: Optional[str] = None,
    ) -> ASRResult:
        """Simulate transcription on test audio."""
        if audio is None or len(audio) == 0:
            return ASRResult(
                transcript="",
                confidence=0.0,
                token_log_probs=[],
                signal_availability=SignalAvailability.UNAVAILABLE,
                language=language or "en",
                duration_seconds=0.0,
                inference_time_ms=0.5,
                model_name=self.model_name,
                model_version=self.model_version,
            )

        duration = float(len(audio) / sample_rate)
        rms = float(np.sqrt(np.mean(audio.astype(np.float32) ** 2) + 1e-9))

        # Test trigger simulation based on audio energy
        if rms > 0.05:
            transcript = "Please process an immediate wire transfer for the CEO directive."
            confidence = 0.95
            token_log_probs = [-0.05, -0.08, -0.04, -0.06]
            availability = SignalAvailability.AVAILABLE
        elif rms > 0.01:
            transcript = "Hello, can you hear me clearly?"
            confidence = 0.88
            token_log_probs = [-0.12, -0.15]
            availability = SignalAvailability.AVAILABLE
        else:
            transcript = ""
            confidence = 0.0
            token_log_probs = []
            availability = SignalAvailability.LOW_CONFIDENCE

        return ASRResult(
            transcript=transcript,
            confidence=confidence,
            token_log_probs=token_log_probs,
            signal_availability=availability,
            language=language or "en",
            duration_seconds=round(duration, 2),
            inference_time_ms=1.5,
            model_name=self.model_name,
            model_version=self.model_version,
        )

    def get_model_version(self) -> str:
        return self.model_version
