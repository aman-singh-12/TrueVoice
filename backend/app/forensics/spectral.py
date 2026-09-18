"""
Spectral Flatness and Spectral Flux Extraction.
Measures frequency energy distribution and frame-to-frame spectral transitions.
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
