"""
Polyphase FIR Resampler.
Converts arbitrary client capture sample rates (44.1kHz, 48kHz, 8kHz, etc.)
to TrueVoice canonical 16,000 Hz Mono float32 [-1.0, 1.0].
"""

import math
import numpy as np
from scipy.signal import resample_poly

from app.core.exceptions import AudioProcessingError


class AudioResampler:
    """High-quality polyphase resampler for streaming audio canonicalization."""

    def __init__(self, target_sample_rate: int = 16000):
        self.target_rate = target_sample_rate

    def resample(self, audio: np.ndarray, source_sample_rate: int) -> np.ndarray:
        """
        Resample 1D float32 audio to canonical target rate (16kHz).
        If source == target, returns a copy with clipping protection.
        """
        if len(audio) == 0:
            return np.array([], dtype=np.float32)

        if source_sample_rate == self.target_rate:
            return np.clip(audio, -1.0, 1.0).astype(np.float32)

        if source_sample_rate <= 0:
            raise AudioProcessingError(f"Invalid source sample rate: {source_sample_rate}")

        try:
            # Simplify fraction using greatest common divisor for polyphase filtering
            gcd = math.gcd(int(source_sample_rate), int(self.target_rate))
            up = int(self.target_rate // gcd)
            down = int(source_sample_rate // gcd)

            resampled = resample_poly(audio, up, down).astype(np.float32)
            # Clip to [-1.0, 1.0] to eliminate potential sinc filter ringing overshoots
            return np.clip(resampled, -1.0, 1.0)
        except Exception as exc:
            raise AudioProcessingError(
                f"Resampling from {source_sample_rate}Hz to {self.target_rate}Hz failed: {str(exc)}"
            )
