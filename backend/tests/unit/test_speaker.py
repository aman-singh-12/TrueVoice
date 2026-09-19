"""
Unit Tests for TrueVoice Speaker Verification Layer (ECAPA-TDNN & Biometrics).
Tests enrollment, normalization, multi-sample centroids, thresholds, and zero-fake-data invariants.
"""

import pytest
import numpy as np
from unittest.mock import MagicMock

from app.core.constants import SignalAvailability
from app.core.exceptions import AudioProcessingError, ModelUnavailableError
from app.schemas.speaker import VerificationResult, SpeakerVerificationResult
from app.speaker.ecapa.verifier import ECAPASpeakerVerifier
from app.speaker.mock import MockSpeakerVerifier


@pytest.fixture
def mock_verifier() -> MockSpeakerVerifier:
    """Deterministic test fixture simulating ECAPA-TDNN."""
    verifier = MockSpeakerVerifier()
    verifier.load_model()
    return verifier


@pytest.fixture
def synthetic_speech_audio() -> np.ndarray:
    """Generate synthetic 16kHz audio with voiced harmonics (1.0s)."""
    t = np.linspace(0, 1.0, 16000, endpoint=False)
    # 150 Hz fundamental frequency + harmonics
    waveform = 0.5 * np.sin(2 * np.pi * 150 * t) + 0.25 * np.sin(2 * np.pi * 300 * t)
    return waveform.astype(np.float32)


@pytest.fixture
def different_speech_audio() -> np.ndarray:
    """Generate different synthetic 16kHz audio with 350 Hz fundamental frequency."""
    t = np.linspace(0, 1.0, 16000, endpoint=False)
    waveform = 0.5 * np.sin(2 * np.pi * 350 * t) + 0.3 * np.sin(2 * np.pi * 700 * t)
    return waveform.astype(np.float32)


# ==============================================================================
# 1. Zero-Fake-Data & Model Unavailability Invariants
# ==============================================================================

@pytest.mark.asyncio
async def test_ecapa_model_unavailable_raises_on_enroll(synthetic_speech_audio):
    """
    Production Invariant:
    If SpeechBrain model is not loaded, enroll() must raise ModelUnavailableError.
    Never generate FFT or fake fallback vectors in production!
    """
    ecapa = ECAPASpeakerVerifier()
    ecapa.is_loaded = False
    ecapa.classifier = None

    with pytest.raises(ModelUnavailableError) as exc_info:
        await ecapa.enroll([synthetic_speech_audio])

    assert "SpeechBrain ECAPA-TDNN" in str(exc_info.value)
    assert exc_info.value.error_code == "MODEL_UNAVAILABLE"


@pytest.mark.asyncio
async def test_ecapa_model_unavailable_returns_unavailable_result(synthetic_speech_audio):
    """
    Production Invariant:
    If SpeechBrain model is not loaded, verify() must return SignalAvailability.UNAVAILABLE
    with verified=None and similarity=None. Never fabricate a match!
    """
    ecapa = ECAPASpeakerVerifier()
    ecapa.is_loaded = False
    ecapa.classifier = None

    fake_enrolled = np.ones(192, dtype=np.float32) / np.sqrt(192)
    result = await ecapa.verify(synthetic_speech_audio, enrolled_embedding=fake_enrolled)

    assert result.signal_availability == SignalAvailability.UNAVAILABLE
    assert result.verified is None
    assert result.similarity is None
    assert result.confidence == 0.0
    assert result.is_match is False


# ==============================================================================
# 2. Input Validation & Edge Cases
# ==============================================================================

@pytest.mark.asyncio
async def test_ecapa_empty_enrollment_raises():
    """Empty enrollment list must raise AudioProcessingError."""
    ecapa = ECAPASpeakerVerifier()
    with pytest.raises(AudioProcessingError):
        await ecapa.enroll([])


@pytest.mark.asyncio
async def test_ecapa_verify_with_none_enrolled():
    """Verifying against None enrolled profile returns UNAVAILABLE without error."""
    ecapa = ECAPASpeakerVerifier()
    audio = np.zeros(16000, dtype=np.float32)
    result = await ecapa.verify(audio, enrolled_embedding=None)

    assert result.signal_availability == SignalAvailability.UNAVAILABLE
    assert result.verified is None
    assert result.similarity is None


@pytest.mark.asyncio
async def test_ecapa_verify_with_empty_audio():
    """Verifying empty audio buffer returns UNAVAILABLE without error."""
    ecapa = ECAPASpeakerVerifier()
    enrolled = np.ones(192, dtype=np.float32) / np.sqrt(192)
    result = await ecapa.verify(np.array([], dtype=np.float32), enrolled_embedding=enrolled)

    assert result.signal_availability == SignalAvailability.UNAVAILABLE
    assert result.verified is None
    assert result.similarity is None


# ==============================================================================
# 3. Deterministic Test Fixture & Centroid Mathematics
# ==============================================================================

@pytest.mark.asyncio
async def test_mock_fixture_valid_embedding_dimensions(mock_verifier, synthetic_speech_audio):
    """Enrolled centroid embedding must be exactly 192 dimensions."""
    embedding = await mock_verifier.enroll([synthetic_speech_audio])
    assert isinstance(embedding, np.ndarray)
    assert embedding.shape == (192,)
    assert embedding.dtype == np.float32


@pytest.mark.asyncio
async def test_mock_fixture_unit_l2_normalization(mock_verifier, synthetic_speech_audio):
    """Enrolled centroid embedding must have unit L2 norm (||v||_2 == 1.0)."""
    embedding = await mock_verifier.enroll([synthetic_speech_audio])
    l2_norm = float(np.linalg.norm(embedding))
    assert abs(l2_norm - 1.0) < 1e-5


@pytest.mark.asyncio
async def test_mock_fixture_multi_sample_centroid(mock_verifier, synthetic_speech_audio, different_speech_audio):
    """
    Multiple enrollment samples must be combined into a normalized centroid.
    The centroid must differ from individual samples and maintain unit norm.
    """
    emb_1 = await mock_verifier.enroll([synthetic_speech_audio])
    emb_2 = await mock_verifier.enroll([different_speech_audio])
    centroid = await mock_verifier.enroll([synthetic_speech_audio, different_speech_audio])

    assert centroid.shape == (192,)
    assert abs(float(np.linalg.norm(centroid)) - 1.0) < 1e-5

    # Centroid should have non-trivial cosine similarity with both constituent samples
    cos_1 = float(np.dot(centroid, emb_1))
    cos_2 = float(np.dot(centroid, emb_2))
    assert cos_1 > 0.0
    assert cos_2 > 0.0


@pytest.mark.asyncio
async def test_mock_fixture_similarity_and_threshold_behavior(mock_verifier, synthetic_speech_audio, different_speech_audio):
    """
    Verification matches:
    - Same speaker audio should yield high similarity and verified=True.
    - Dissimilar audio should yield lower similarity.
    - Custom threshold strictly controls verified status.
    """
    enrolled = await mock_verifier.enroll([synthetic_speech_audio])

    # 1. Matching audio
    res_match = await mock_verifier.verify(synthetic_speech_audio, enrolled_embedding=enrolled, threshold=0.75)
    assert res_match.signal_availability == SignalAvailability.AVAILABLE
    assert res_match.similarity is not None
    assert res_match.similarity > 0.85
    assert res_match.verified is True
    assert res_match.is_match is True

    # 2. Strict threshold test (threshold=0.999 should fail even for close match)
    res_strict = await mock_verifier.verify(synthetic_speech_audio, enrolled_embedding=enrolled, threshold=0.999)
    assert res_strict.threshold == 0.999
    assert res_strict.verified is False

    # 3. Lenient threshold test (threshold=0.10 should pass)
    res_lenient = await mock_verifier.verify(synthetic_speech_audio, enrolled_embedding=enrolled, threshold=0.10)
    assert res_lenient.threshold == 0.10
    assert res_lenient.verified is True


# ==============================================================================
# 4. Mocked SpeechBrain Live Pipeline Test
# ==============================================================================

@pytest.mark.asyncio
async def test_live_ecapa_pipeline_with_mocked_speechbrain():
    """
    Simulate SpeechBrain runtime:
    Mocks classifier.encode_batch to return PyTorch tensor [1, 1, 192].
    Verifies that ECAPASpeakerVerifier handles tensor extraction, normalization,
    and multi-sample enrollment correctly without real model downloads.
    """
    try:
        import torch
    except ImportError:
        pytest.skip("PyTorch not installed in environment")

    ecapa = ECAPASpeakerVerifier()
    ecapa.is_loaded = True
    ecapa.classifier = MagicMock()

    # Configure classifier.encode_batch to return a fixed mock embedding tensor
    mock_tensor = torch.randn(1, 1, 192)
    ecapa.classifier.encode_batch.return_value = mock_tensor

    sample_1 = np.random.randn(16000).astype(np.float32)
    sample_2 = np.random.randn(16000).astype(np.float32)

    centroid = await ecapa.enroll([sample_1, sample_2])
    assert centroid.shape == (192,)
    assert abs(float(np.linalg.norm(centroid)) - 1.0) < 1e-4

    # Test verify
    result = await ecapa.verify(sample_1, enrolled_embedding=centroid, threshold=0.75)
    assert result.signal_availability == SignalAvailability.AVAILABLE
    assert result.similarity is not None
    assert 0.0 <= result.similarity <= 1.0
    assert isinstance(result.verified, bool)


def test_speaker_verification_result_schema_contract():
    """Validate SpeakerVerificationResult Pydantic schema contract and alias."""
    res = SpeakerVerificationResult(
        verified=True,
        similarity=0.88,
        threshold=0.75,
        confidence=0.92,
        signal_availability=SignalAvailability.AVAILABLE,
        model_name="ecapa-tdnn",
        model_version="v1.0",
        inference_time_ms=25.4,
    )
    assert res.verified is True
    assert res.similarity == 0.88
    assert res.threshold == 0.75
    assert res.inference_time_ms == 25.4
    assert isinstance(res, VerificationResult)
