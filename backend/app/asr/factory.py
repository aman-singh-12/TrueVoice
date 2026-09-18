"""
TrueVoice Speech Recognizer Factory.
Returns configured Whisper or Mock speech recognizer based on application settings.
"""

from typing import Optional
from app.config import get_settings
from app.asr.base import SpeechRecognizer
from app.asr.mock import MockSpeechRecognizer
from app.asr.whisper import WhisperSpeechRecognizer

_asr_instance: Optional[SpeechRecognizer] = None


def get_speech_recognizer() -> SpeechRecognizer:
    """Retrieve or initialize active SpeechRecognizer singleton."""
    global _asr_instance
    if _asr_instance is None:
        settings = get_settings()
        if settings.ml_mock_mode:
            _asr_instance = MockSpeechRecognizer()
        else:
            _asr_instance = WhisperSpeechRecognizer(device=settings.ml_device)
        _asr_instance.load_model()
    return _asr_instance
