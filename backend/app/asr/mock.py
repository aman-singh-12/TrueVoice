"""
Mock Speech Recognizer.
Provides fast, deterministic simulated transcripts for testing without downloading Whisper models.
"""

import numpy as np

from app.asr.base import ASRResult, SpeechRecognizer
from app.core.constants import SignalAvailability


class MockSpeechRecognizer(SpeechRecognizer):
    """Deterministic ASR simulation for CI and tests."""

    def __init__(self, model_version: str = "mock-asr-v1.0"):
        self.model_version = model_version
        self.model_name = "mock-whisper"
        self.is_loaded = False

    def load_model(self, device: str = "cpu") -> None:
        self.is_loaded = True

    async def transcribe(self, audio: np.ndarray, sample_rate: int = 16000) -> ASRResult:
        if len(audio) == 0:
            return ASRResult(
                transcript="",
                confidence=0.0,
                token_log_probs=[],
                signal_availability=SignalAvailability.UNAVAILABLE,
                language="en",
                duration_seconds=0.0,
                model_name=self.model_name,
                model_version=self.model_version,
            )

        duration = float(len(audio) / sample_rate)
        rms = float(np.sqrt(np.mean(audio**2) + 1e-9))

        # If audio has noticeable energy, return simulated dialogue for test triggers
        if rms > 0.05:
            transcript = "Please process an immediate wire transfer for the CEO directive."
            confidence = 0.95
            token_log_probs = [-0.15, -0.22, -0.08, -0.19]
            availability = SignalAvailability.AVAILABLE
        elif rms > 0.01:
            transcript = "Hello, can you hear me clearly?"
            confidence = 0.88
            token_log_probs = [-0.25, -0.30]
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
            language="en",
            duration_seconds=round(duration, 2),
            model_name=self.model_name,
            model_version=self.model_version,
        )

    def get_model_version(self) -> str:
        return self.model_version
