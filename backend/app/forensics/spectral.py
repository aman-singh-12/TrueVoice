"""
Spectral Flatness, Spectral Flux, Spectral Centroid, and Spectral Rolloff Extraction.
Measures frequency energy distribution and frame-to-frame spectral transitions.
Deterministic physical acoustic signal measurements.
"""

from typing import Tuple
import numpy as np


def compute_spectral_features(
    audio: np.ndarray, n_fft: int = 512, hop_len: int = 256
) -> Tuple[float, float]:
    """
    Compute Spectral Flatness (Wiener entropy) and Spectral Flux.
    Returns: (mean_flatness: float, mean_flux: float)
    """
    if len(audio) < n_fft:
        return 0.0, 0.0

    num_frames = (len(audio) - n_fft) // hop_len + 1
    window = np.hanning(n_fft)

    spectrogram = []
    for i in range(num_frames):
        start = i * hop_len
        frame = audio[start : start + n_fft] * window
        mag = np.abs(np.fft.rfft(frame))
        spectrogram.append(mag)

    spec = np.array(spectrogram)  # shape (frames, freq_bins)

    # 1. Spectral Flatness: Geometric mean / Arithmetic mean
    geom_mean = np.exp(np.mean(np.log(spec + 1e-12), axis=1))
    arith_mean = np.mean(spec, axis=1) + 1e-12
    flatness = np.mean(geom_mean / arith_mean)

    # 2. Spectral Flux: Frame-to-frame L2 normalized spectral difference
    if len(spec) > 1:
        diffs = np.diff(spec, axis=0)
        flux = float(np.mean(np.sqrt(np.sum(diffs**2, axis=1))))
    else:
        flux = 0.0

    return float(flatness), float(flux)


def compute_spectral_centroid(
    audio: np.ndarray, sample_rate: int = 16000, n_fft: int = 512, hop_len: int = 256
) -> float:
    """
    Compute mean Spectral Centroid (center of mass of spectrum in Hz).
    High spectral centroid indicates high-frequency energy concentration.
    """
    if len(audio) < n_fft:
        return 0.0

    num_frames = (len(audio) - n_fft) // hop_len + 1
    window = np.hanning(n_fft)
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / sample_rate)

    centroids = []
    for i in range(num_frames):
        start = i * hop_len
        frame = audio[start : start + n_fft] * window
        mag = np.abs(np.fft.rfft(frame))
        mag_sum = np.sum(mag)
        if mag_sum > 1e-12:
            centroid = np.sum(freqs * mag) / mag_sum
            centroids.append(centroid)

    return float(np.mean(centroids)) if centroids else 0.0


def compute_spectral_rolloff(
    audio: np.ndarray,
    sample_rate: int = 16000,
    roll_percent: float = 0.85,
    n_fft: int = 512,
    hop_len: int = 256,
) -> float:
    """
    Compute mean Spectral Rolloff (frequency below which roll_percent of spectral energy resides).
    """
    if len(audio) < n_fft:
        return 0.0

    num_frames = (len(audio) - n_fft) // hop_len + 1
    window = np.hanning(n_fft)
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / sample_rate)

    rolloffs = []
    for i in range(num_frames):
        start = i * hop_len
        frame = audio[start : start + n_fft] * window
        mag_sq = np.abs(np.fft.rfft(frame)) ** 2
        threshold = roll_percent * np.sum(mag_sq)
        cum_energy = np.cumsum(mag_sq)
        idx = np.searchsorted(cum_energy, threshold)
        idx = min(idx, len(freqs) - 1)
        rolloffs.append(freqs[idx])

    return float(np.mean(rolloffs)) if rolloffs else 0.0
