"""
Shimmer Extraction (Cycle-to-Cycle Amplitude Perturbation).
Human speech displays micro-variations in peak vocal amplitude (typical shimmer 3.0% - 7.0%).
Synthetic speech often produces unnaturally constant peak amplitudes (< 1.5%).
"""

import numpy as np


def compute_shimmer_local(
    audio: np.ndarray,
    f0_contour: np.ndarray,
    sample_rate: int = 16000,
    hop_length_ms: float = 10.0,
) -> float:
    """
    Calculate local shimmer percentage across peak amplitudes of voiced frames.
    Returns: shimmer_relative (float)
    """
    voiced_indices = np.where(f0_contour > 0.0)[0]
    if len(voiced_indices) < 3:
        return 0.0

    hop_samples = int(sample_rate * hop_length_ms / 1000.0)
    frame_samples = hop_samples * 2

    amplitudes = []
    for idx in voiced_indices:
        start = idx * hop_samples
        end = min(len(audio), start + frame_samples)
        if start >= len(audio):
            break
        frame = audio[start:end]
        if len(frame) > 0:
            peak = float(np.max(np.abs(frame)))
            amplitudes.append(peak)

    if len(amplitudes) < 3:
        return 0.0

    amps = np.array(amplitudes, dtype=np.float32)
    amp_diffs = np.abs(np.diff(amps))
    mean_amp = np.mean(amps)

    shimmer_rel = float(np.mean(amp_diffs) / (mean_amp + 1e-12))
    return shimmer_rel
