"""
Fundamental Frequency (F0) Tracking & Discontinuity Detection.
Tracks pitch contours on raw forensic audio frames using autocorrelation.
Detects unnatural pitch step jumps (> 50 Hz).
"""

from typing import List, Tuple
import numpy as np


def extract_f0_contour(
    audio: np.ndarray,
    sample_rate: int = 16000,
    frame_length_ms: float = 30.0,
    hop_length_ms: float = 10.0,
    f0_min: float = 60.0,
    f0_max: float = 450.0,
) -> Tuple[np.ndarray, float, float]:
    """
    Extract frame-by-frame F0 contour using short-term normalized autocorrelation.
    Returns:
        (f0_contour: np.ndarray, mean_f0: float, max_pitch_jump_hz: float)
    """
    if len(audio) == 0:
        return np.array([], dtype=np.float32), 0.0, 0.0

    frame_len = int(sample_rate * frame_length_ms / 1000.0)
    hop_len = int(sample_rate * hop_length_ms / 1000.0)

    lag_min = int(sample_rate / f0_max)
    lag_max = int(sample_rate / f0_min)

    num_frames = max(1, (len(audio) - frame_len) // hop_len + 1)
    f0_values: List[float] = []

    for i in range(num_frames):
        start = i * hop_len
        frame = audio[start : start + frame_len]
        if len(frame) < frame_len:
            break

        # Remove DC offset & apply Hann window
        frame = frame - np.mean(frame)
        window = np.hanning(len(frame))
        windowed = frame * window

        # Autocorrelation via FFT
        fft = np.fft.rfft(windowed, n=frame_len * 2)
        corr = np.fft.irfft(fft * np.conj(fft))[:frame_len]
        corr_norm = corr[0] + 1e-12

        # Search for peak in pitch lag range [lag_min, lag_max]
        search_region = corr[lag_min : min(lag_max, len(corr))]
        if len(search_region) == 0:
            f0_values.append(0.0)
            continue

        peak_idx = np.argmax(search_region) + lag_min
        peak_val = corr[peak_idx] / corr_norm

        # Voiced frame decision: autocorrelation peak > 0.35
        if peak_val >= 0.35 and peak_idx > 0:
            pitch_hz = float(sample_rate / peak_idx)
            f0_values.append(pitch_hz)
        else:
            f0_values.append(0.0)

    f0_arr = np.array(f0_values, dtype=np.float32)
    voiced = f0_arr[f0_arr > 0.0]
    mean_f0 = float(np.mean(voiced)) if len(voiced) > 0 else 0.0

    # Calculate maximum cycle-to-cycle step jump across voiced frames
    max_jump = 0.0
    if len(voiced) > 1:
        diffs = np.abs(np.diff(voiced))
        max_jump = float(np.max(diffs))

    return f0_arr, mean_f0, max_jump
