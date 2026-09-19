"""
Unit Tests for TrueVoice Speech Recognition Layer (faster-whisper ASR).
Tests streaming transcription, multilingual configuration, confidence bounds, and zero-fake-data invariants.
"""

import pytest
import numpy as np
from unittest.mock import MagicMock

from app.asr.base import ASRResult
from app.asr.whisper import WhisperSpeechRecognizer
from app.asr.mock import MockSpeechRecognizer
from app.core.constants import SignalAvailability


@pytest.fixture
def mock_asr() -> MockSpeechRecognizer:
    """Deterministic test fixture simulating faster-whisper."""
    asr = MockSpeechRecognizer()
    asr.load_model()
    return asr


@pytest.fixture
def synthetic_speech_audio() -> np.ndarray:
    """Generate non-trivial audio with speech-like energy (1.0s at 16kHz)."""
    t = np.linspace(0, 1.0, 16000, endpoint=False)
    waveform = 0.3 * np.sin(2 * np.pi * 200 * t) + 0.15 * np.sin(2 * np.pi * 400 * t)
    return waveform.astype(np.float32)


# ==============================================================================
# 1. Zero-Fake-Data & Model Unavailability Invariants
# ==============================================================================

@pytest.mark.asyncio
async def test_whisper_model_unavailable_returns_unavailable_status(synthetic_speech_audio):
    """
    Production Invariant:
    If faster-whisper model is not loaded, transcribe() must return
    SignalAvailability.UNAVAILABLE and an EMPTY transcript.
    Never output fake/simulated dialogue in production!
    """
    whisper = WhisperSpeechRecognizer()
    whisper.is_loaded = False
    whisper.model = None

    result = await whisper.transcribe(synthetic_speech_audio)

    assert result.signal_availability == SignalAvailability.UNAVAILABLE
    assert result.transcript == ""
    assert result.confidence == 0.0
    assert result.token_log_probs == []


@pytest.mark.asyncio
async def test_whisper_empty_audio_returns_unavailable():
    """Transcribing empty audio chunk must immediately return UNAVAILABLE without error."""
    whisper = WhisperSpeechRecognizer()
    whisper.is_loaded = True

    result = await whisper.transcribe(np.array([], dtype=np.float32))

    assert result.signal_availability == SignalAvailability.UNAVAILABLE
    assert result.transcript == ""
    assert result.confidence == 0.0
    assert result.duration_seconds == 0.0


# ==============================================================================
# 2. Schema Contract & Confidence Bounds
# ==============================================================================

def test_asr_result_schema_contract():
    """Verify ASRResult Pydantic schema validation and field constraints."""
    result = ASRResult(
        transcript="Security clearance approved.",
        confidence=0.94,
        token_log_probs=[-0.05, -0.07],
        signal_availability=SignalAvailability.AVAILABLE,
        language="en",
        duration_seconds=2.0,
        inference_time_ms=45.2,
        model_name="faster-whisper-small",
        model_version="faster-whisper-small-v1.0",
    )
    assert result.transcript == "Security clearance approved."
    assert 0.0 <= result.confidence <= 1.0
    assert result.inference_time_ms == 45.2
    assert result.language == "en"
    assert result.signal_availability == SignalAvailability.AVAILABLE


# ==============================================================================
# 3. Multilingual Support & Configuration
# ==============================================================================

@pytest.mark.asyncio
async def test_asr_multilingual_language_parameter(mock_asr, synthetic_speech_audio):
    """
    Verify that language parameter is properly propagated for multilingual ASR.
    Supports English ('en'), Hindi ('hi'), Punjabi ('pa'), and auto-detection.
    """
    # Test Hindi specification
    res_hi = await mock_asr.transcribe(synthetic_speech_audio, language="hi")
    assert res_hi.language == "hi"

    # Test Punjabi specification
    res_pa = await mock_asr.transcribe(synthetic_speech_audio, language="pa")
    assert res_pa.language == "pa"

    # Test default English
    res_en = await mock_asr.transcribe(synthetic_speech_audio)
    assert res_en.language == "en"


# ==============================================================================
# 4. Deterministic Test Fixture Behavior
# ==============================================================================

@pytest.mark.asyncio
async def test_mock_asr_silence_behavior(mock_asr):
    """Silence (very low RMS) should produce low confidence / empty text."""
    silent_audio = np.zeros(16000, dtype=np.float32)
    result = await mock_asr.transcribe(silent_audio)

    assert result.transcript == ""
    assert result.confidence == 0.0
    assert result.signal_availability == SignalAvailability.LOW_CONFIDENCE


@pytest.mark.asyncio
async def test_mock_asr_speech_audio_behavior(mock_asr, synthetic_speech_audio):
    """Speech energy in test fixture should produce valid simulated transcript."""
    result = await mock_asr.transcribe(synthetic_speech_audio)

    assert len(result.transcript) > 0
    assert result.confidence > 0.8
    assert result.signal_availability == SignalAvailability.AVAILABLE
    assert len(result.token_log_probs) > 0
    assert result.duration_seconds == 1.0


# ==============================================================================
# 5. Live Pipeline Simulation with Mocked CTranslate2 Engine
# ==============================================================================

@pytest.mark.asyncio
async def test_live_whisper_pipeline_with_mocked_model(synthetic_speech_audio):
    """
    Simulate faster-whisper CTranslate2 runtime:
    Mocks model.transcribe() to return simulated segments and info metadata.
    Verifies that WhisperSpeechRecognizer extracts transcripts, computes confidence
    from token log-probabilities via exp(mean(logprob)), and sets availability correctly.
    """
    whisper = WhisperSpeechRecognizer(model_size="small")
    whisper.is_loaded = True
    whisper.model = MagicMock()

    # Create mock segments
    seg1 = MagicMock()
    seg1.text = "Authentication request for account"
    seg1.avg_logprob = -0.15

    seg2 = MagicMock()
    seg2.text = "one two three."
    seg2.avg_logprob = -0.22

    mock_info = MagicMock()
    mock_info.language = "en"

    whisper.model.transcribe.return_value = ([seg1, seg2], mock_info)

    result = await whisper.transcribe(synthetic_speech_audio)

    assert result.signal_availability == SignalAvailability.AVAILABLE
    assert result.transcript == "Authentication request for account one two three."
    assert result.language == "en"
    # avg_logprob mean = -0.185 -> exp(-0.185) ~ 0.831
    assert 0.80 <= result.confidence <= 0.86
    assert result.token_log_probs == [-0.15, -0.22]
    assert result.inference_time_ms >= 0.0
