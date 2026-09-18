"""
Audio Decoder & Ingestion Validation.
Decodes raw PCM16 binary chunks, WAV bytes, and formats them into float32 [-1.0, 1.0] NumPy arrays.
"""

import io
import wave
from typing import Tuple
import numpy as np

from app.core.exceptions import AudioProcessingError


def decode_pcm16_le(raw_bytes: bytes) -> np.ndarray:
    """
    Decode signed 16-bit little-endian linear PCM bytes into float32 array in [-1.0, 1.0].
    """
    if len(raw_bytes) == 0:
        return np.array([], dtype=np.float32)
    
    # Ensure byte length is even (2 bytes per 16-bit sample)
    remainder = len(raw_bytes) % 2
    if remainder != 0:
        raw_bytes = raw_bytes[:-remainder]

    int16_samples = np.frombuffer(raw_bytes, dtype=np.int16)
    float32_samples = int16_samples.astype(np.float32) / 32768.0
    return float32_samples


def decode_wav_bytes(wav_bytes: bytes) -> Tuple[np.ndarray, int]:
    """
    Decode standard RIFF/WAV file bytes.
    Returns: (float32_samples, sample_rate)
    """
    try:
        with io.BytesIO(wav_bytes) as bio:
            with wave.open(bio, "rb") as wf:
                sample_rate = wf.getframerate()
                num_channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                num_frames = wf.getnframes()
                raw_frames = wf.readframes(num_frames)

                if sample_width == 2:  # 16-bit PCM
                    int16_data = np.frombuffer(raw_frames, dtype=np.int16)
                    float_data = int16_data.astype(np.float32) / 32768.0
                elif sample_width == 1:  # 8-bit unsigned
                    uint8_data = np.frombuffer(raw_frames, dtype=np.uint8)
                    float_data = (uint8_data.astype(np.float32) - 128.0) / 128.0
                elif sample_width == 4:  # 32-bit float or int
                    float_data = np.frombuffer(raw_frames, dtype=np.float32)
                else:
                    raise AudioProcessingError(f"Unsupported WAV sample width: {sample_width} bytes")

                # If stereo/multichannel, average channels to mono
                if num_channels > 1:
                    float_data = float_data.reshape(-1, num_channels).mean(axis=1)

                return float_data, sample_rate
    except Exception as exc:
        raise AudioProcessingError(f"Failed to decode WAV audio: {str(exc)}")


class AudioDecoder:
    """Unified audio decoder for WAV and raw PCM16 streams."""

    @staticmethod
    def decode(raw_bytes: bytes, default_sample_rate: int = 16000) -> Tuple[np.ndarray, int, int]:
        """
        Detects header format (WAV RIFF vs Raw PCM16) and decodes to float32 mono.
        Returns: (float32_array, sample_rate, channels)
        """
        if raw_bytes.startswith(b"RIFF"):
            audio, sr = decode_wav_bytes(raw_bytes)
            return audio, sr, 1
        else:
            audio = decode_pcm16_le(raw_bytes)
            return audio, default_sample_rate, 1

