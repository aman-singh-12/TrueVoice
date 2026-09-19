"""
Acoustic Robustness and Adversarial Stress Testing.
Fulfills Person 5 Part G requirements:
Evaluates TrueVoice deepfake detector against acoustic edge-cases through its public interface:
- Total silence
- Ultra-short audio (<0.5s, 0.1s)
- Additive environmental noise
- Saturated / clipped audio
- Telephony bandpass filtering (300-3400Hz)
- Codec compression (G.711) and 8kHz resampling
- Empty audio array
Documents detector degradation objectively without modifying detector code.
"""

import pytest
import numpy as np

from app.detectors.mock import MockDeepfakeDetector
from benchmarks.augmentations.codec_simulator import CodecSimulator
from benchmarks.augmentations.acoustic_perturbations import AcousticPerturbations
from benchmarks.datasets.reference_generator import ReferenceAudioGenerator


@pytest.fixture
def detector():
    det = MockDeepfakeDetector()
    det.load_model(device="cpu")
    return det


@pytest.fixture
def clean_speech():
    gen = ReferenceAudioGenerator()
    return gen.synthesize_authentic(seed=1234, f0=150.0)


@pytest.mark.robustness
@pytest.mark.asyncio
async def test_empty_audio_signal_handling(detector):
    """Robustness test: Empty audio array does not crash the detector."""
    empty_arr = np.array([], dtype=np.float32)
    result = await detector.predict(empty_arr, sample_rate=16000)

    assert result is not None
    assert result.score == 0.0
    assert result.confidence == 0.0
    assert result.model_name == detector.get_model_name()


@pytest.mark.robustness
@pytest.mark.asyncio
async def test_digital_silence_handling(detector):
    """Robustness test: 2.0s of pure digital silence does not cause NaN or division by zero."""
    silence = AcousticPerturbations.generate_silence(duration_seconds=2.0)
    result = await detector.predict(silence, sample_rate=16000)

    assert result is not None
    assert not np.isnan(result.score)
    assert not np.isinf(result.score)
    assert result.score <= 50.0  # Silence should not trigger false positive synthetic alert


@pytest.mark.robustness
@pytest.mark.asyncio
async def test_ultra_short_audio_bursts(detector, clean_speech):
    """Robustness test: Short audio durations (0.5s, 0.25s, 0.1s) execute without index/shape errors."""
    for duration in [0.5, 0.25, 0.1, 0.05]:
        truncated = AcousticPerturbations.truncate_duration(clean_speech, target_seconds=duration)
        result = await detector.predict(truncated, sample_rate=16000)

        assert result is not None
        assert not np.isnan(result.score)
        assert result.inference_time_ms >= 0.0


@pytest.mark.robustness
@pytest.mark.asyncio
async def test_clipped_and_saturated_audio(detector, clean_speech):
    """Robustness test: Saturated / clipped waveform produces bounded risk score."""
    clipped = AcousticPerturbations.apply_clipping(clean_speech, threshold=0.3)
    result = await detector.predict(clipped, sample_rate=16000)

    assert result is not None
    assert 0.0 <= result.score <= 100.0
    assert not np.isnan(result.confidence)


@pytest.mark.robustness
@pytest.mark.asyncio
async def test_telephony_channel_degradation(detector, clean_speech):
    """Robustness test: PSTN bandpass filtering (300-3400Hz) evaluates gracefully."""
    telephony_audio = CodecSimulator.telephony_bandpass(clean_speech, sample_rate=16000)
    result = await detector.predict(telephony_audio, sample_rate=16000)

    assert result is not None
    assert 0.0 <= result.score <= 100.0


@pytest.mark.robustness
@pytest.mark.asyncio
async def test_g711_mulaw_codec_compression(detector, clean_speech):
    """Robustness test: G.711 mu-law 8-bit companded audio evaluates without error."""
    mulaw_audio = CodecSimulator.g711_mulaw_transcode(clean_speech)
    result = await detector.predict(mulaw_audio, sample_rate=16000)

    assert result is not None
    assert 0.0 <= result.score <= 100.0


@pytest.mark.robustness
@pytest.mark.asyncio
async def test_resampled_narrowband_8khz(detector, clean_speech):
    """Robustness test: Narrowband 8kHz downsampled/upsampled audio evaluates safely."""
    resampled = CodecSimulator.resample_narrowband(clean_speech, orig_sr=16000, narrow_sr=8000)
    result = await detector.predict(resampled, sample_rate=16000)

    assert result is not None
    assert 0.0 <= result.score <= 100.0


@pytest.mark.robustness
@pytest.mark.asyncio
async def test_heavy_noise_awgn(detector, clean_speech):
    """Robustness test: Heavy additive noise (0dB SNR) evaluates cleanly."""
    noisy = AcousticPerturbations.add_awgn(clean_speech, snr_db=0.0)
    result = await detector.predict(noisy, sample_rate=16000)

    assert result is not None
    assert 0.0 <= result.score <= 100.0


@pytest.mark.robustness
@pytest.mark.asyncio
async def test_multi_speaker_mixing(detector):
    """Robustness test: Mixed overlapping speakers evaluate cleanly."""
    gen = ReferenceAudioGenerator()
    spk1 = gen.synthesize_authentic(seed=1, f0=120.0)
    spk2 = gen.synthesize_authentic(seed=2, f0=220.0)

    mixed = AcousticPerturbations.mix_speakers(spk1, spk2, secondary_ratio=0.5)
    result = await detector.predict(mixed, sample_rate=16000)

    assert result is not None
    assert 0.0 <= result.score <= 100.0
