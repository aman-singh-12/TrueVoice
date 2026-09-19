"""
Audio Codec & Telephony Channel Laundering Simulator.
Adapted from audio-df-ucb/ClonedVoiceDetection research principles.
Provides pure DSP simulation of G.711, narrowband PSTN telephony, and VoIP transmission artifacts.
"""

import numpy as np
from scipy import signal


class CodecSimulator:
    """Simulates realistic VoIP and PSTN telephony compression and quantization artifacts."""

    @staticmethod
    def g711_mulaw_transcode(audio: np.ndarray, mu: float = 255.0) -> np.ndarray:
        """
        Simulate G.711 mu-law 8-bit companding and quantization:
        y = sgn(x) * ln(1 + mu*|x|) / ln(1 + mu)
        Quantized to 256 discrete levels (8-bit) and expanded back to float32.
        """
        if len(audio) == 0:
            return audio.copy()

        x = np.clip(audio, -1.0, 1.0).astype(np.float64)
        # Companding
        companded = np.sign(x) * np.log1p(mu * np.abs(x)) / np.log1p(mu)
        # 8-bit quantization: maps [-1, 1] to [-128, 127]
        quantized = np.round(companded * 127.0)
        quantized = np.clip(quantized, -128.0, 127.0)
        # Expansion
        norm_q = quantized / 127.0
        expanded = np.sign(norm_q) * (1.0 / mu) * ((1.0 + mu) ** np.abs(norm_q) - 1.0)
        return expanded.astype(np.float32)

    @staticmethod
    def g711_alaw_transcode(audio: np.ndarray, a: float = 87.6) -> np.ndarray:
        """
        Simulate European G.711 A-law 8-bit companding and quantization.
        """
        if len(audio) == 0:
            return audio.copy()

        x = np.clip(audio, -1.0, 1.0).astype(np.float64)
        abs_x = np.abs(x)
        sign_x = np.sign(x)

        companded = np.zeros_like(x)
        mask = abs_x < (1.0 / a)
        companded[mask] = sign_x[mask] * (a * abs_x[mask]) / (1.0 + np.log(a))
        companded[~mask] = sign_x[~mask] * (1.0 + np.log(a * abs_x[~mask])) / (1.0 + np.log(a))

        # 8-bit quantization
        quantized = np.round(companded * 127.0)
        quantized = np.clip(quantized, -128.0, 127.0)
        norm_q = quantized / 127.0
        abs_q = np.abs(norm_q)

        # Expansion
        expanded = np.zeros_like(norm_q)
        inv_mask = abs_q < (1.0 / (1.0 + np.log(a)))
        expanded[inv_mask] = np.sign(norm_q[inv_mask]) * (abs_q[inv_mask] * (1.0 + np.log(a))) / a
        expanded[~inv_mask] = np.sign(norm_q[~inv_mask]) * np.exp(abs_q[~inv_mask] * (1.0 + np.log(a)) - 1.0) / a

        return expanded.astype(np.float32)

    @staticmethod
    def telephony_bandpass(
        audio: np.ndarray,
        sample_rate: int = 16000,
        low_freq: float = 300.0,
        high_freq: float = 3400.0,
        order: int = 4,
    ) -> np.ndarray:
        """
        Apply standard PSTN telephony bandpass filter (300 Hz - 3400 Hz).
        Eliminates sub-300Hz chest resonance and >3.4kHz high-frequency speech harmonics.
        """
        if len(audio) == 0:
            return audio.copy()

        nyquist = 0.5 * sample_rate
        low = low_freq / nyquist
        high = min(high_freq / nyquist, 0.99)

        sos = signal.butter(order, [low, high], btype="bandpass", output="sos")
        filtered = signal.sosfilt(sos, audio)
        return filtered.astype(np.float32)

    @staticmethod
    def resample_narrowband(
        audio: np.ndarray,
        orig_sr: int = 16000,
        narrow_sr: int = 8000,
    ) -> np.ndarray:
        """
        Simulate narrowband transmission: downsample 16kHz -> 8kHz, then upsample back to 16kHz.
        Accurately introduces aliasing and reconstruction attenuation.
        """
        if len(audio) == 0:
            return audio.copy()

        # Downsample to 8kHz
        num_down = int(len(audio) * (narrow_sr / orig_sr))
        downsampled = signal.resample(audio, num_down)

        # Upsample back to 16kHz
        upsampled = signal.resample(downsampled, len(audio))
        return upsampled.astype(np.float32)

    @staticmethod
    def simulate_voip_packet_loss(
        audio: np.ndarray,
        sample_rate: int = 16000,
        loss_rate: float = 0.05,
        packet_ms: float = 20.0,
    ) -> np.ndarray:
        """
        Simulate lossy VoIP packet dropout (e.g. Opus 20ms frames dropped with linear concealment).
        """
        if len(audio) == 0 or loss_rate <= 0.0:
            return audio.copy()

        frame_size = int((packet_ms / 1000.0) * sample_rate)
        if frame_size <= 0:
            return audio.copy()

        out = audio.copy()
        n_frames = len(out) // frame_size

        rng = np.random.RandomState(42)  # Deterministic seed for reproducible evaluation
        for i in range(n_frames):
            if rng.uniform(0.0, 1.0) < loss_rate:
                start = i * frame_size
                end = min(start + frame_size, len(out))
                # Dropout: zero out frame or attenuate drastically
                out[start:end] *= 0.05

        return out.astype(np.float32)
