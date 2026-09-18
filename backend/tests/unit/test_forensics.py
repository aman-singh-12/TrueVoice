"""
Unit Tests for Acoustic Forensics (Branch 1).
Verifies physical acoustic anomaly measurement and feature decoupling.
"""

import numpy as np
import pytest

from app.forensics.f0 import extract_f0_contour
from app.forensics.jitter import compute_jitter_local
from app.forensics.shimmer import compute_shimmer_local
from app.forensics.hnr import compute_hnr_db
from app.forensics.spectral import compute_spectral_features
from app.forensics.analyzer import ForensicAnalyzer


def test_f0_extraction():
    """Verify autocorrelation pitch extraction on synthetic 200 Hz tone."""
    sr = 16000
    t = np.linspace(0, 0.5, int(sr * 0.5))
    tone = (0.5 * np.sin(2 * np.pi * 200 * t)).astype(np.float32)
    f0_contour, f0_mean, max_jump = extract_f0_contour(tone, sample_rate=sr)
    assert 180 <= f0_mean <= 220
    assert max_jump >= 0.0


def test_spectral_features():
    """Verify spectral flatness and flux calculations."""
    sr = 16000
    t = np.linspace(0, 0.5, int(sr * 0.5))
    tone = (0.5 * np.sin(2 * np.pi * 400 * t)).astype(np.float32)
    flatness, flux = compute_spectral_features(tone)
    assert 0.0 <= flatness <= 1.0
    assert flux >= 0.0



def test_forensic_analyzer_decoupling():
    """Verify ForensicAnalyzer returns raw physical measurements independently in features dict."""
    analyzer = ForensicAnalyzer()
    audio = np.random.uniform(-0.1, 0.1, 32000).astype(np.float32)
    result = analyzer.analyze(audio, sample_rate=16000)

    assert 0.0 <= result.score <= 100.0
    assert "mean_f0_hz" in result.features
    assert "jitter_local" in result.features
    assert "shimmer_local" in result.features
    assert "hnr_db" in result.features
    assert "spectral_flatness" in result.features
