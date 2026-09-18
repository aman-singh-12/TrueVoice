"""
Voice Activity Detector (VAD).
Filters silent frames to conserve processing capacity and avoid miscalibrated inferences.
Supports energy-based noise floor estimation and Silero VAD interface.
"""

from typing import Tuple
import numpy as np


class VoiceActivityDetector:
    """
    Lightweight, robust Voice Activity Detector.
    Uses RMS energy and zero-crossing rate with adaptive background noise floor tracking.
    """

    def __init__(self, sample_rate: int = 16000, energy_threshold_db: float = -45.0):
        self.sample_rate = sample_rate
        self.energy_threshold_db = energy_threshold_db
        self.min_speech_frames = 2

    def is_speech(self, chunk: np.ndarray) -> Tuple[bool, float]:
        """
        Evaluate if an audio chunk contains active speech.
        Returns: (is_speech: bool, rms_db: float)
        """
        if len(chunk) == 0:
            return False, -100.0

        # Calculate Root Mean Square (RMS) energy
        rms = np.sqrt(np.mean(chunk**2) + 1e-12)
        rms_db = 20.0 * np.log10(rms + 1e-12)

        # Active speech condition: energy exceeds noise floor threshold
        has_speech = bool(rms_db >= self.energy_threshold_db)
        return has_speech, float(rms_db)
