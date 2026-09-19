"""
Abstract Base Class for Benchmark Dataset Adapters.
Standardizes audio sample loading, ground truth annotation, and generator provenance.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Iterator
import numpy as np


@dataclass
class BenchmarkAudioSample:
    """Standardized benchmark audio sample container."""

    sample_id: str
    audio: np.ndarray  # 1D float32 normalized in [-1.0, 1.0]
    sample_rate: int  # Canonical 16000
    is_synthetic: bool  # True = Spoof / Synthetic, False = Authentic / Bona Fide
    dataset_name: str  # E.g. "wavefake", "asvspoof2019", "reference_ci"
    generator_name: Optional[str] = None  # E.g. "hifi_gan", "melgan", "human_natural"
    speaker_id: Optional[str] = None
    metadata: Optional[dict] = None


class DatasetAdapter(ABC):
    """Abstract interface for audio dataset loaders."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if local dataset files exist on disk, False otherwise."""
        pass

    @abstractmethod
    def get_dataset_name(self) -> str:
        """Return human-readable identifier."""
        pass

    @abstractmethod
    def load_samples(self, limit: Optional[int] = None) -> List[BenchmarkAudioSample]:
        """Load benchmark samples into memory. Must not fabricate data if dataset is missing."""
        pass
