"""
Canonical Audio Processing Pipeline.
Coordinates Decoding -> Resampling -> VAD -> Circular Buffer -> Two-Branch Splitting.
"""

from typing import Optional, Tuple
import numpy as np

from app.audio.decoder import decode_pcm16_le
from app.audio.resampler import AudioResampler
from app.audio.vad import VoiceActivityDetector
from app.audio.buffer import CircularAudioBuffer
from app.config import settings


class AudioPipeline:
    """Session-level audio ingestion pipeline."""

    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.resampler = AudioResampler(target_sample_rate=sample_rate)
        self.vad = VoiceActivityDetector(sample_rate=sample_rate)
        self.buffer = CircularAudioBuffer(capacity_seconds=10.0, sample_rate=sample_rate)
        self.samples_since_last_hop = 0
        self.hop_samples = settings.HOP_SAMPLES

    def process_incoming_chunk(
        self, raw_bytes: bytes, source_sample_rate: int
    ) -> Tuple[int, bool]:
        """
        Decode, resample to 16kHz, evaluate VAD, and write to circular buffer.
        Returns: (total_buffer_samples: int, contains_speech: bool)
        """
        # 1. Decode PCM16 bytes to float32
        audio_float = decode_pcm16_le(raw_bytes)
        if len(audio_float) == 0:
            return self.buffer.available_samples, False

        # 2. Resample to 16,000 Hz if necessary
        canonical_audio = self.resampler.resample(audio_float, source_sample_rate)

        # 3. Check VAD
        has_speech, _ = self.vad.is_speech(canonical_audio)

        # 4. Write to circular buffer
        total_samples = self.buffer.write(canonical_audio)
        self.samples_since_last_hop += len(canonical_audio)

        return total_samples, has_speech

    def is_hop_ready(self) -> bool:
        """Check if at least one hop duration (0.5s = 8000 samples) has accumulated."""
        return self.samples_since_last_hop >= self.hop_samples

    def extract_analysis_window(self) -> Optional[Tuple[np.ndarray, np.ndarray]]:
        """
        Extract synchronized (ml_chunk, forensic_chunk) window if hop ready and buffer full.
        Resets the hop accumulator on success.
        """
        if not self.is_hop_ready():
            return None

        window = self.buffer.extract_two_branch_window(window_seconds=settings.WINDOW_SECONDS)
        if window is not None:
            self.samples_since_last_hop = 0
        return window
