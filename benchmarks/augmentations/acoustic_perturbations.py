"""
Acoustic Degradation & Adversarial Perturbation Suite.
Evaluates model robustness against real-world environmental noise, clipping, volume fluctuations,
and edge-case signals (silence, ultra-short speech, multi-speaker overlap).
"""

import numpy as np


class AcousticPerturbations:
    """Acoustic transformations simulating environmental stress and transmission flaws."""

    @staticmethod
    def add_awgn(audio: np.ndarray, snr_db: float = 10.0, seed: int = 42) -> np.ndarray:
        """
        Add Additive White Gaussian Noise (AWGN) at specified Signal-to-Noise Ratio (SNR) in dB.
        """
        if len(audio) == 0:
            return audio.copy()

        signal_power = np.mean(audio**2)
        if signal_power == 0.0:
            return audio.copy()

        snr_linear = 10.0 ** (snr_db / 10.0)
        noise_power = signal_power / snr_linear
        rng = np.random.RandomState(seed)
        noise = rng.normal(0.0, np.sqrt(noise_power), len(audio))

        degraded = audio + noise
        return np.clip(degraded, -1.0, 1.0).astype(np.float32)

    @staticmethod
    def scale_volume_db(audio: np.ndarray, gain_db: float) -> np.ndarray:
        """
        Apply volume scaling in decibels.
        gain_db < 0: attenuation (e.g. -12dB for quiet / distant microphone)
        gain_db > 0: amplification (+6dB)
        """
        gain_linear = 10.0 ** (gain_db / 20.0)
        scaled = audio * gain_linear
        return np.clip(scaled, -1.0, 1.0).astype(np.float32)

    @staticmethod
    def apply_clipping(audio: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        """
        Simulate microphone pre-amp saturation and analog-to-digital converter (ADC) hard clipping.
        Clamps values outside [-threshold, threshold] and rescales to [-1.0, 1.0].
        """
        if len(audio) == 0:
            return audio.copy()

        clamped = np.clip(audio, -threshold, threshold)
        if threshold > 0.0:
            clamped = clamped / threshold
        return clamped.astype(np.float32)

    @staticmethod
    def truncate_duration(
        audio: np.ndarray,
        target_seconds: float,
        sample_rate: int = 16000,
    ) -> np.ndarray:
        """
        Truncate audio to evaluate short and ultra-short speech bursts (e.g. 0.1s, 0.25s, 0.5s).
        """
        target_samples = int(target_seconds * sample_rate)
        if len(audio) <= target_samples:
            return audio.copy()
        return audio[:target_samples].copy().astype(np.float32)

    @staticmethod
    def generate_silence(duration_seconds: float = 2.0, sample_rate: int = 16000) -> np.ndarray:
        """Generate pure digital silence (all zeros)."""
        return np.zeros(int(duration_seconds * sample_rate), dtype=np.float32)

    @staticmethod
    def mix_speakers(
        primary_audio: np.ndarray,
        secondary_audio: np.ndarray,
        secondary_ratio: float = 0.5,
    ) -> np.ndarray:
        """
        Simulate multi-speaker cross-talk or background voice interference.
        """
        min_len = min(len(primary_audio), len(secondary_audio))
        if min_len == 0:
            return primary_audio.copy()

        mixed = primary_audio[:min_len] + secondary_ratio * secondary_audio[:min_len]
        max_val = np.max(np.abs(mixed))
        if max_val > 1.0:
            mixed = mixed / max_val
        return mixed.astype(np.float32)
