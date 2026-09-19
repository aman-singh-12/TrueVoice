"""
TrueVoice Speech Recognizer Factory.
Resolves either production faster-whisper or the test-only mock fixture
based on application configuration (TRUEVOICE_ML_MODE).
"""

import logging
from typing import Optional
from app.config import get_settings
from app.asr.base import SpeechRecognizer
from app.asr.mock import MockSpeechRecognizer
from app.asr.whisper import WhisperSpeechRecognizer

logger = logging.getLogger(__name__)

_asr_instance: Optional[SpeechRecognizer] = None


def get_speech_recognizer() -> SpeechRecognizer:
    """Retrieve or initialize active SpeechRecognizer singleton."""
    global _asr_instance
    if _asr_instance is None:
        settings = get_settings()
        if settings.ml_mock_mode:
            logger.warning(
                "Initializing MockSpeechRecognizer: TEST-ONLY FIXTURE ACTIVE. "
                "Do not use in production deployments."
            )
            _asr_instance = MockSpeechRecognizer()
        else:
            logger.info(
                f"Initializing production faster-whisper recognizer "
                f"(Model: {settings.TRUEVOICE_ASR_MODEL}, Device: {settings.TRUEVOICE_ASR_DEVICE}, "
                f"Compute: {settings.TRUEVOICE_ASR_COMPUTE_TYPE})"
            )
            _asr_instance = WhisperSpeechRecognizer(
                model_size=settings.TRUEVOICE_ASR_MODEL,
                device=settings.TRUEVOICE_ASR_DEVICE,
                compute_type=settings.TRUEVOICE_ASR_COMPUTE_TYPE,
            )
        _asr_instance.load_model()
    return _asr_instance


def reset_speech_recognizer() -> None:
    """Reset the singleton instance (primarily for test fixture isolation)."""
    global _asr_instance
    _asr_instance = None
