"""
Harmonics-to-Noise Ratio (HNR) Extraction.
Measures the ratio of periodic vocal cord energy to aperiodic aspiration noise.
Healthy authentic speech typically has HNR between 18 dB and 30 dB.
Neural vocoders with phase dispersion or buzzing often degrade HNR below 15 dB.
"""

import numpy as np


def compute_hnr_db(audio: np.ndarray, sample_rate: int = 16000) -> float:
    """
    Compute average Harmonics-to-Noise Ratio (HNR) in decibels using autocorrelation.
    """
    if len(audio) < 512:
        return 0.0

    # Frame-based autocorrelation
    frame_len = 512
    hop_len = 256
    num_frames = (len(audio) - frame_len) // hop_len + 1

    hnr_values = []

    for i in range(num_frames):
        start = i * hop_len
        frame = audio[start : start + frame_len]
        frame = frame - np.mean(frame)
        if np.std(frame) < 1e-4:
            continue

        corr = np.correlate(frame, frame, mode="full")
        corr = corr[len(corr) // 2 :]

        # Look for the first periodic peak after zero-lag drop
        # Human pitch range 60-450Hz at 16kHz -> lag range 35 to 266
        search_region = corr[35:266]
        if len(search_region) == 0:
            continue

        r0 = corr[0]
        r_max = np.max(search_region)

        if r_max <= 0 or r_max >= r0:
            continue

        # HNR = 10 * log10(r_max / (r0 - r_max))
        noise_energy = max(1e-12, r0 - r_max)
        hnr = 10.0 * np.log10(r_max / noise_energy)
        hnr_values.append(hnr)

    if not hnr_values:
        return 20.0  # Default nominal value if unvoiced

    return float(np.mean(hnr_values))
