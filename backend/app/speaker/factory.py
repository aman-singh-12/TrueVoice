"""
TrueVoice Speaker Verifier Factory.
Returns configured ECAPA-TDNN or Mock verifier based on application settings.
"""

from typing import Optional
from app.config import get_settings
from app.speaker.base import SpeakerVerifier
from app.speaker.mock import MockSpeakerVerifier
from app.speaker.ecapa.verifier import ECAPASpeakerVerifier

_speaker_verifier_instance: Optional[SpeakerVerifier] = None


def get_speaker_verifier() -> SpeakerVerifier:
    """Retrieve or initialize the active SpeakerVerifier singleton."""
    global _speaker_verifier_instance
    if _speaker_verifier_instance is None:
        settings = get_settings()
        if settings.ml_mock_mode:
            _speaker_verifier_instance = MockSpeakerVerifier()
        else:
            _speaker_verifier_instance = ECAPASpeakerVerifier(device=settings.ml_device)
        _speaker_verifier_instance.load_model()
    return _speaker_verifier_instance
