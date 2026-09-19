"""
Energy, RMS, and Zero-Crossing Rate (ZCR) Extraction for Acoustic Forensics.
Deterministic physical signal measurements operating independently from neural spoof models.
"""

from typing import Dict, Tuple
import numpy as np


def compute_rms_energy(audio: np.ndarray) -> float:
    """
    Calculate Root Mean Square (RMS) energy of the audio signal.
    Returns: float normalized RMS value.
    """
    if len(audio) == 0:
        return 0.0
    mean_sq = float(np.mean(audio.astype(np.float64) ** 2))
    return float(np.sqrt(max(0.0, mean_sq)))


def compute_zcr(audio: np.ndarray, frame_length: int = 512, hop_length: int = 256) -> float:
    """
    Calculate mean Zero-Crossing Rate (ZCR).
    Measures the rate of sign-changes along the signal, indicative of noise/turbulence and voicing.
    """
    if len(audio) < frame_length:
        if len(audio) < 2:
            return 0.0
        signs = np.sign(audio)
        signs[signs == 0] = 1
        return float(np.mean(np.abs(np.diff(signs)) > 0) / 2.0)

    num_frames = (len(audio) - frame_length) // hop_length + 1
    zcrs = []
    for i in range(num_frames):
        start = i * hop_length
        frame = audio[start : start + frame_length]
        signs = np.sign(frame)
        signs[signs == 0] = 1
        zcr = np.mean(np.abs(np.diff(signs)) > 0) / 2.0
        zcrs.append(zcr)

    return float(np.mean(zcrs)) if zcrs else 0.0


def compute_energy_distribution(audio: np.ndarray, sample_rate: int = 16000, n_fft: int = 512) -> Dict[str, float]:
    """
    Compute energy distribution across canonical frequency bands:
    - Low: 0 - 500 Hz (Fundamental & sub-harmonics)
    - Mid: 500 - 3000 Hz (Formants / vowel resonance)
    - High: 3000 - 8000 Hz (Fricatives / vocoder phase artifacts)
    """
    if len(audio) < n_fft:
        return {"low_ratio": 0.33, "mid_ratio": 0.34, "high_ratio": 0.33}

    window = np.hanning(min(len(audio), n_fft))
    frame = audio[: len(window)] * window
    mag = np.abs(np.fft.rfft(frame))
    freqs = np.fft.rfftfreq(len(frame), d=1.0 / sample_rate)

    total_energy = float(np.sum(mag**2)) + 1e-12
    low_mask = freqs < 500.0
    mid_mask = (freqs >= 500.0) & (freqs < 3000.0)
    high_mask = freqs >= 3000.0

    low_energy = float(np.sum(mag[low_mask] ** 2))
    mid_energy = float(np.sum(mag[mid_mask] ** 2))
    high_energy = float(np.sum(mag[high_mask] ** 2))

    return {
        "low_ratio": round(low_energy / total_energy, 4),
        "mid_ratio": round(mid_energy / total_energy, 4),
        "high_ratio": round(high_energy / total_energy, 4),
    }
