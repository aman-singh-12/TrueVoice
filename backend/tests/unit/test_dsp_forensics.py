"""
Unit Tests for Hardened DSP / Acoustic Forensics Engine (Part A).
Verifies deterministic physical acoustic feature extraction, signal availability,
energy metrics, spectral metrics, and evidence list extraction.
"""

import numpy as np
import pytest

from app.forensics.energy import compute_rms_energy, compute_zcr, compute_energy_distribution
from app.forensics.spectral import (
    compute_spectral_features,
    compute_spectral_centroid,
    compute_spectral_rolloff,
)
from app.forensics.analyzer import ForensicAnalyzer


def test_energy_metrics_deterministic():
    """Verify deterministic calculation of RMS energy, ZCR, and energy distribution."""
    sr = 16000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    # 440 Hz pure tone with amplitude 0.5
    audio = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

    rms = compute_rms_energy(audio)
    # Theoretical RMS of 0.5 * sin(x) is 0.5 / sqrt(2) ≈ 0.3535
    assert 0.34 <= rms <= 0.36

    zcr = compute_zcr(audio)
    # 440 Hz / 16000 ≈ 0.0275
    assert 0.025 <= zcr <= 0.030

    dist = compute_energy_distribution(audio, sample_rate=sr)
    assert pytest.approx(dist["low_ratio"] + dist["mid_ratio"] + dist["high_ratio"], abs=1e-3) == 1.0
    # 440 Hz falls in low band (<500 Hz)
    assert dist["low_ratio"] > 0.90


def test_spectral_centroid_and_rolloff():
    """Verify spectral centroid and rolloff for pure tone vs noise."""
    sr = 16000
    t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
    tone_1k = (0.6 * np.sin(2 * np.pi * 1000 * t)).astype(np.float32)

    centroid = compute_spectral_centroid(tone_1k, sample_rate=sr)
    # Centroid for 1000 Hz tone should be around 1000 Hz
    assert 900 <= centroid <= 1100

    rolloff = compute_spectral_rolloff(tone_1k, sample_rate=sr, roll_percent=0.85)
    assert rolloff >= 900

    flatness, flux = compute_spectral_features(tone_1k)
    # Pure tone has very low flatness (< 0.1)
    assert 0.0 <= flatness < 0.1
    assert flux >= 0.0


def test_silence_handling():
    """Verify zero/silent audio handling does not crash or divide-by-zero."""
    silence = np.zeros(16000, dtype=np.float32)

    assert compute_rms_energy(silence) == 0.0
    assert compute_zcr(silence) == 0.0
    dist = compute_energy_distribution(silence, sample_rate=16000)
    assert isinstance(dist, dict)

    analyzer = ForensicAnalyzer()
    res = analyzer.analyze(silence, sample_rate=16000)
    assert res.score == 0.0
    assert res.available is False
    assert isinstance(res.evidence, list)


def test_forensic_analyzer_comprehensive_features():
    """Verify ForensicAnalyzer extracts all physical metrics and evidence flags."""
    analyzer = ForensicAnalyzer()
    sr = 16000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    # Synthesize audio with slight harmonic content
    audio = (0.4 * np.sin(2 * np.pi * 220 * t) + 0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

    res = analyzer.analyze(audio, sample_rate=sr)
    assert 0.0 <= res.score <= 100.0
    assert res.available is True
    expected_keys = [
        "rms_energy",
        "zcr",
        "mean_f0_hz",
        "max_pitch_jump_hz",
        "jitter_local",
        "shimmer_local",
        "hnr_db",
        "spectral_flatness",
        "spectral_flux",
        "spectral_centroid_hz",
        "spectral_rolloff_hz",
        "energy_distribution",
        "voiced_ratio",
    ]
    for key in expected_keys:
        assert key in res.features, f"Missing expected forensic feature: {key}"

    assert isinstance(res.evidence, list)
