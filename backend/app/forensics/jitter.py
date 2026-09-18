"""
Jitter Extraction (Cycle-to-Cycle Frequency Perturbation).
Natural human vocal folds exhibit micro-tremors (typical jitter 0.5% - 2.0%).
Synthetic vocoders often over-smooth pitch, resulting in unnaturally low jitter (< 0.2%).
"""

from typing import Tuple
import numpy as np


def compute_jitter_local(f0_contour: np.ndarray) -> Tuple[float, float]:
    """
    Calculate local jitter percentage from consecutive voiced frames.
    Returns: (jitter_relative: float, jitter_absolute_sec: float)
    """
    voiced_f0 = f0_contour[f0_contour > 0.0]
    if len(voiced_f0) < 3:
        return 0.0, 0.0

    periods = 1.0 / voiced_f0
    period_diffs = np.abs(np.diff(periods))
    mean_period = np.mean(periods)

    jitter_abs = float(np.mean(period_diffs))
    jitter_rel = float(jitter_abs / (mean_period + 1e-12))

    return jitter_rel, jitter_abs
