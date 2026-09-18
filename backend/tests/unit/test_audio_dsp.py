"""
Unit Tests for Audio Ingestion, Decoding, Resampling, VAD, and Circular Buffering.
"""

import numpy as np
import pytest

from app.audio.decoder import decode_pcm16_le, AudioDecoder
from app.audio.resampler import AudioResampler
from app.audio.vad import VoiceActivityDetector
from app.audio.buffer import CircularAudioBuffer
from app.audio.pipeline import AudioPipeline


def test_decode_pcm16_le():
    """Verify conversion from 16-bit PCM bytes to float32 [-1.0, 1.0]."""
    raw_zeros = b"\x00\x00" * 100
    decoded = decode_pcm16_le(raw_zeros)
    assert len(decoded) == 100
    assert np.all(decoded == 0.0)

    # Max positive int16: 32767 -> approx 1.0
    raw_max = (32767).to_bytes(2, byteorder="little", signed=True)
    decoded_max = decode_pcm16_le(raw_max)
    assert pytest.approx(decoded_max[0], abs=1e-4) == 1.0


def test_audio_resampler():
    """Verify polyphase FIR resampling from 8kHz to 16kHz."""
    resampler = AudioResampler(target_sample_rate=16000)
    # 0.1s of 8000Hz audio = 800 samples
    samples_8k = np.sin(2 * np.pi * 440 * np.linspace(0, 0.1, 800)).astype(np.float32)
    resampled_16k = resampler.resample(samples_8k, source_sample_rate=8000)
    # At 16kHz, 0.1s should yield approx 1600 samples
    assert abs(len(resampled_16k) - 1600) <= 10


def test_voice_activity_detector():
    """Verify energy-based VAD detects speech above noise floor and ignores silence."""
    vad = VoiceActivityDetector(sample_rate=16000)
    silence = np.zeros(1600, dtype=np.float32)
    has_speech_silence, _ = vad.is_speech(silence)
    assert not has_speech_silence

    # Active tone simulating speech
    tone = (0.2 * np.sin(2 * np.pi * 300 * np.linspace(0, 0.1, 1600))).astype(np.float32)
    has_speech_tone, _ = vad.is_speech(tone)
    assert has_speech_tone


def test_circular_audio_buffer_two_branch():
    """Verify synchronized ML and Forensic branch extraction from circular buffer."""
    buf = CircularAudioBuffer(capacity_seconds=5.0, sample_rate=16000)
    # Write 2.5 seconds of audio (40,000 samples)
    data = np.ones(40000, dtype=np.float32) * 0.5
    buf.write(data)
    assert buf.available_samples == 40000

    # Extract 2.0s window (32,000 samples)
    extracted = buf.extract_two_branch_window(window_seconds=2.0)
    assert extracted is not None
    ml_chunk, forensic_chunk = extracted
    assert len(ml_chunk) == 32000
    assert len(forensic_chunk) == 32000
    # Both branches initially identical copies
    np.testing.assert_array_equal(ml_chunk, forensic_chunk)


def test_audio_pipeline_accumulation():
    """Verify AudioPipeline requires full 2.0s window before extracting hop."""
    pipeline = AudioPipeline(sample_rate=16000)
    # Supply 1.0s of audio (16,000 samples = 32,000 bytes)
    chunk_1s = (np.ones(16000, dtype=np.float32) * 16000).astype(np.int16).tobytes()
    pipeline.process_incoming_chunk(chunk_1s, 16000)

    # 1.0s is hop ready (>0.5s) but not window ready (<2.0s)
    window = pipeline.extract_analysis_window()
    assert window is None

    # Supply another 1.0s (total 2.0s accumulated)
    pipeline.process_incoming_chunk(chunk_1s, 16000)
    window = pipeline.extract_analysis_window()
    assert window is not None
    ml_chunk, forensic_chunk = window
    assert len(ml_chunk) == 32000
