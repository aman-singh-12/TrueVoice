"""
Thread-Safe Circular Audio Buffer.
Maintains continuous streaming audio in a circular array.
Extracts overlapping 2.0-second analysis windows with 0.5-second hop duration.
"""

import threading
from typing import Optional, Tuple
import numpy as np


class CircularAudioBuffer:
    """
    Efficient, thread-safe circular buffer for real-time streaming audio ingestion.
    Capacity: 10.0 seconds of 16kHz audio (160,000 samples).
    """

    def __init__(self, capacity_seconds: float = 10.0, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.capacity: int = int(capacity_seconds * sample_rate)
        self.buffer: np.ndarray = np.zeros(self.capacity, dtype=np.float32)
        self.write_head: int = 0
        self.available_samples: int = 0
        self.lock = threading.Lock()

    def write(self, samples: np.ndarray) -> int:
        """
        Write 1D float32 samples into the circular buffer.
        Returns the total number of samples currently available.
        """
        if len(samples) == 0:
            with self.lock:
                return self.available_samples

        samples = samples.astype(np.float32)
        n = len(samples)

        with self.lock:
            # If incoming chunk exceeds buffer capacity, keep only the latest segment
            if n >= self.capacity:
                samples = samples[-self.capacity:]
                n = self.capacity

            end_head = (self.write_head + n) % self.capacity
            if self.write_head + n <= self.capacity:
                self.buffer[self.write_head : self.write_head + n] = samples
            else:
                first_part = self.capacity - self.write_head
                self.buffer[self.write_head :] = samples[:first_part]
                self.buffer[:end_head] = samples[first_part:]

            self.write_head = end_head
            self.available_samples = min(self.capacity, self.available_samples + n)
            return self.available_samples

    def extract_two_branch_window(
        self, window_seconds: float = 2.0
    ) -> Optional[Tuple[np.ndarray, np.ndarray]]:
        """
        Extract synchronized 2.0s audio chunks for both branches if sufficient audio accumulated:
        Returns:
            (canonical_ml_chunk, raw_forensic_chunk)
            or None if available_samples < window_samples.
        """
        window_samples = int(window_seconds * self.sample_rate)

        with self.lock:
            if self.available_samples < window_samples:
                return None

            start_head = (self.write_head - window_samples) % self.capacity
            if start_head + window_samples <= self.capacity:
                raw_chunk = self.buffer[start_head : start_head + window_samples].copy()
            else:
                first_len = self.capacity - start_head
                raw_chunk = np.concatenate([
                    self.buffer[start_head:],
                    self.buffer[: window_samples - first_len],
                ])

        # 1. Forensic Branch: Raw, minimally processed, un-normalized audio chunk
        forensic_chunk = raw_chunk.copy()

        # 2. Canonical ML Branch: Canonical float32 audio chunk (model adapters apply model-specific transforms)
        ml_chunk = raw_chunk.copy()

        return ml_chunk, forensic_chunk

    def clear(self) -> None:
        """Reset the buffer state."""
        with self.lock:
            self.buffer.fill(0.0)
            self.write_head = 0
            self.available_samples = 0
