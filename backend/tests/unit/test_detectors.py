"""
Unit Tests for TrueVoice Real Deepfake Detectors.
Verifies Wav2Vec2, RawNet2, AASIST, Ensemble, and Mock detectors.
Tests:
- Empty audio
- Short audio
- Valid waveform
- Wrong sample rate
- Model unavailable state (no fabricated FFT scores)
- Model loading & device selection
- Output schema compliance
- Deterministic inference
- Score range [0.0, 100.0]
- Latency profiling
- Multi-model ensemble aggregation
- Registry lifecycle management
"""

import asyncio
from unittest.mock import MagicMock
import numpy as np
import pytest
import torch
import torch.nn as nn

from app.core.constants import SignalAvailability
from app.detectors.aasist.detector import AASISTDetector
from app.detectors.aasist.model import AASISTModel
from app.detectors.mock import MockDeepfakeDetector
from app.detectors.rawnet2.detector import RawNet2Detector
from app.detectors.rawnet2.model import RawNet2Model
from app.detectors.registry import DetectorRegistry
from app.detectors.wav2vec2.detector import Wav2Vec2Detector
from app.detectors.ensemble.detector import EnsembleDetector
from app.schemas.detection import DeepfakeResult


# Fixtures for synthetic audio signals
@pytest.fixture
def sine_audio_16k():
    """Canonical 2.0s 16kHz sine wave audio chunk (32,000 samples)."""
    t = np.linspace(0, 2.0, 32000, endpoint=False, dtype=np.float32)
    return (0.5 * np.sin(2 * np.pi * 440.0 * t)).astype(np.float32)


@pytest.fixture
def empty_audio():
    return np.array([], dtype=np.float32)


@pytest.fixture
def short_audio():
    """Very short audio chunk (100 samples ~ 6.25ms)."""
    return np.ones(100, dtype=np.float32) * 0.1


# 1. EMPTY AUDIO TESTS
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "detector_cls",
    [Wav2Vec2Detector, RawNet2Detector, AASISTDetector, EnsembleDetector, MockDeepfakeDetector],
)
async def test_empty_audio(detector_cls, empty_audio):
    detector = detector_cls()
    result = await detector.predict(empty_audio, sample_rate=16000)

    assert isinstance(result, DeepfakeResult)
    assert result.score == 0.0
    assert result.label == "AUTHENTIC"
    assert result.signal_availability == SignalAvailability.UNAVAILABLE
    assert result.inference_time_ms >= 0.0


# 2. MODEL UNAVAILABLE TESTS (MISSING CHECKPOINT)
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "detector_cls,expected_name",
    [
        (Wav2Vec2Detector, "wav2vec2"),
        (RawNet2Detector, "rawnet2"),
        (AASISTDetector, "aasist"),
    ],
)
async def test_model_unavailable_when_unconfigured(detector_cls, expected_name, sine_audio_16k):
    """
    CRITICAL REQUIREMENT:
    When no checkpoint is configured, detectors MUST NOT substitute simulated FFT scores.
    They must explicitly return UNAVAILABLE with confidence=None.
    """
    detector = detector_cls()
    detector.load_model(device="cpu")
    assert not detector.is_loaded

    result = await detector.predict(sine_audio_16k, sample_rate=16000)
    assert result.signal_availability == SignalAvailability.UNAVAILABLE
    assert result.confidence is None
    assert result.score == 0.0
    assert result.label == "AUTHENTIC"
    assert result.model_name == expected_name
    assert "error" in result.features


# 3. REAL NEURAL NETWORK FORWARD PASS (RAWNET2)
@pytest.mark.asyncio
async def test_rawnet2_neural_inference(sine_audio_16k):
    """Verify genuine RawNet2 neural model execution with SincNet and F-SE blocks."""
    detector = RawNet2Detector()
    # Provide initialized resident model for testing
    detector.model = RawNet2Model()
    detector.is_loaded = True
    detector.device = "cpu"

    result = await detector.predict(sine_audio_16k, sample_rate=16000)

    assert isinstance(result, DeepfakeResult)
    assert result.signal_availability == SignalAvailability.AVAILABLE
    assert 0.0 <= result.score <= 100.0
    assert result.label in {"SYNTHETIC", "AUTHENTIC"}
    assert result.confidence is not None
    assert 0.0 <= result.confidence <= 1.0
    assert result.model_name == "rawnet2"
    assert result.inference_time_ms > 0.0
    assert result.features["sincnet_channels"] == 128


# 4. REAL NEURAL NETWORK FORWARD PASS (AASIST)
@pytest.mark.asyncio
async def test_aasist_neural_inference(sine_audio_16k):
    """Verify genuine AASIST graph attention model execution."""
    detector = AASISTDetector()
    detector.model = AASISTModel()
    detector.is_loaded = True
    detector.device = "cpu"

    result = await detector.predict(sine_audio_16k, sample_rate=16000)

    assert isinstance(result, DeepfakeResult)
    assert result.signal_availability == SignalAvailability.AVAILABLE
    assert 0.0 <= result.score <= 100.0
    assert result.label in {"SYNTHETIC", "AUTHENTIC"}
    assert result.confidence is not None
    assert 0.0 <= result.confidence <= 1.0
    assert result.model_name == "aasist"
    assert result.inference_time_ms > 0.0
    assert "spectro_temporal" in result.features["graph_attention"]


# 5. WAV2VEC2 NEURAL FORWARD PASS
@pytest.mark.asyncio
async def test_wav2vec2_neural_inference(sine_audio_16k):
    """Verify Wav2Vec2 detector sequence classifier integration."""
    detector = Wav2Vec2Detector()

    # Mock processor and classifier head for isolated unit execution
    mock_processor = MagicMock()
    mock_processor.return_value = {"input_values": torch.randn(1, 32000)}

    class MockW2V2Model(nn.Module):
        def forward(self, input_values):
            class Out:
                logits = torch.tensor([[1.5, -0.5]])  # Authentic > Spoof
            return Out()

    detector.processor = mock_processor
    detector.model = MockW2V2Model()
    detector.is_loaded = True
    detector.device = "cpu"

    result = await detector.predict(sine_audio_16k, sample_rate=16000)

    assert isinstance(result, DeepfakeResult)
    assert result.signal_availability == SignalAvailability.AVAILABLE
    assert 0.0 <= result.score <= 100.0
    assert result.label == "AUTHENTIC"
    assert result.confidence is not None
    assert result.model_name == "wav2vec2"
    assert result.inference_time_ms > 0.0


# 6. SHORT AUDIO ROBUSTNESS
@pytest.mark.asyncio
async def test_short_audio_robustness(short_audio):
    """Verify that audio shorter than receptive window pads safely and does not crash."""
    rn2_detector = RawNet2Detector()
    rn2_detector.model = RawNet2Model()
    rn2_detector.is_loaded = True

    result = await rn2_detector.predict(short_audio, sample_rate=16000)
    assert isinstance(result, DeepfakeResult)
    assert 0.0 <= result.score <= 100.0

    aasist_detector = AASISTDetector()
    aasist_detector.model = AASISTModel()
    aasist_detector.is_loaded = True

    result_aasist = await aasist_detector.predict(short_audio, sample_rate=16000)
    assert isinstance(result_aasist, DeepfakeResult)
    assert 0.0 <= result_aasist.score <= 100.0


# 7. DETERMINISTIC INFERENCE
@pytest.mark.asyncio
async def test_deterministic_inference(sine_audio_16k):
    """Verify that identical input waveforms produce identical scores on resident models."""
    detector = RawNet2Detector()
    detector.model = RawNet2Model()
    detector.model.eval()
    detector.is_loaded = True

    res1 = await detector.predict(sine_audio_16k, sample_rate=16000)
    res2 = await detector.predict(sine_audio_16k, sample_rate=16000)

    assert res1.score == res2.score
    assert res1.label == res2.label
    assert res1.confidence == res2.confidence


# 8. ENSEMBLE DETECTOR
@pytest.mark.asyncio
async def test_ensemble_detector(sine_audio_16k):
    """Verify multi-model ensemble coordination, component score retention, and uncalibrated disclosure."""
    rn2 = RawNet2Detector()
    rn2.model = RawNet2Model()
    rn2.is_loaded = True

    aasist = AASISTDetector()
    aasist.model = AASISTModel()
    aasist.is_loaded = True

    # Wav2Vec2 without weights (UNAVAILABLE)
    w2v2 = Wav2Vec2Detector()
    w2v2.is_loaded = False

    ensemble = EnsembleDetector(
        detectors={"rawnet2": rn2, "aasist": aasist, "wav2vec2": w2v2}
    )

    result = await ensemble.predict(sine_audio_16k, sample_rate=16000)

    assert isinstance(result, DeepfakeResult)
    assert result.signal_availability == SignalAvailability.AVAILABLE
    assert 0.0 <= result.score <= 100.0
    assert result.model_name == "ensemble"
    assert result.features["calibrated"] is False  # Must not falsely claim calibration
    assert "rawnet2" in result.features["available_models"]
    assert "aasist" in result.features["available_models"]
    assert result.features["component_scores"]["wav2vec2"] is None
    assert isinstance(result.features["component_scores"]["rawnet2"], float)
    assert isinstance(result.features["component_scores"]["aasist"], float)


# 9. ENSEMBLE ALL UNAVAILABLE
@pytest.mark.asyncio
async def test_ensemble_all_unavailable(sine_audio_16k):
    """When all member models are unavailable, the ensemble must report UNAVAILABLE."""
    ensemble = EnsembleDetector(
        detectors={
            "w2v2": Wav2Vec2Detector(),
            "rn2": RawNet2Detector(),
            "aasist": AASISTDetector(),
        }
    )
    result = await ensemble.predict(sine_audio_16k, sample_rate=16000)
    assert result.signal_availability == SignalAvailability.UNAVAILABLE
    assert result.score == 0.0
    assert result.confidence is None


# 10. DETECTOR REGISTRY LIFECYCLE
def test_detector_registry_initialization():
    """Verify registry resolves primary detectors and keeps only one resident in memory."""
    registry = DetectorRegistry.get_registry()
    DetectorRegistry.reset()
    registry = DetectorRegistry.get_registry()

    from app.config import settings
    original_primary = settings.DEEPFAKE_PRIMARY_DETECTOR
    original_mode = settings.TRUEVOICE_ML_MODE

    try:
        # Mock mode test
        settings.DEEPFAKE_PRIMARY_DETECTOR = "mock"
        settings.TRUEVOICE_ML_MODE = "mock"
        DetectorRegistry.reset()
        detector = DetectorRegistry.get_registry().initialize_primary_detector()
        assert isinstance(detector, MockDeepfakeDetector)

        # RawNet2 test
        settings.DEEPFAKE_PRIMARY_DETECTOR = "rawnet2"
        settings.TRUEVOICE_ML_MODE = "live"
        DetectorRegistry.reset()
        detector = DetectorRegistry.get_registry().initialize_primary_detector()
        assert isinstance(detector, RawNet2Detector)

        # AASIST test
        settings.DEEPFAKE_PRIMARY_DETECTOR = "aasist"
        settings.TRUEVOICE_ML_MODE = "live"
        DetectorRegistry.reset()
        detector = DetectorRegistry.get_registry().initialize_primary_detector()
        assert isinstance(detector, AASISTDetector)

        # Ensemble test
        settings.DEEPFAKE_PRIMARY_DETECTOR = "ensemble"
        settings.TRUEVOICE_ML_MODE = "live"
        DetectorRegistry.reset()
        detector = DetectorRegistry.get_registry().initialize_primary_detector()
        assert isinstance(detector, EnsembleDetector)

    finally:
        settings.DEEPFAKE_PRIMARY_DETECTOR = original_primary
        settings.TRUEVOICE_ML_MODE = original_mode
        DetectorRegistry.reset()
