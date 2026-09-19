"""
TrueVoice Speaker Verifier Factory.
Resolves either production SpeechBrain ECAPA-TDNN or the test-only mock fixture
based on application configuration (TRUEVOICE_ML_MODE).
"""

import logging
from typing import Optional
from app.config import get_settings
from app.speaker.base import SpeakerVerifier
from app.speaker.mock import MockSpeakerVerifier
from app.speaker.ecapa.verifier import ECAPASpeakerVerifier

logger = logging.getLogger(__name__)

_speaker_verifier_instance: Optional[SpeakerVerifier] = None


def get_speaker_verifier() -> SpeakerVerifier:
    """Retrieve or initialize the active SpeakerVerifier singleton."""
    global _speaker_verifier_instance
    if _speaker_verifier_instance is None:
        settings = get_settings()
        if settings.ml_mock_mode:
            logger.warning(
                "Initializing MockSpeakerVerifier: TEST-ONLY FIXTURE ACTIVE. "
                "Do not use in production deployments."
            )
            _speaker_verifier_instance = MockSpeakerVerifier()
        else:
            logger.info(
                f"Initializing production SpeechBrain ECAPA-TDNN verifier "
                f"(Device: {settings.TRUEVOICE_SPEAKER_DEVICE}, Source: {settings.SPEAKER_MODEL_SOURCE})"
            )
            _speaker_verifier_instance = ECAPASpeakerVerifier(
                device=settings.TRUEVOICE_SPEAKER_DEVICE,
                model_source=settings.SPEAKER_MODEL_SOURCE,
            )
        _speaker_verifier_instance.load_model()
    return _speaker_verifier_instance


def reset_speaker_verifier() -> None:
    """Reset the singleton instance (primarily for test fixture isolation)."""
    global _speaker_verifier_instance
    _speaker_verifier_instance = None
