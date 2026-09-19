"""
WaveFake Dataset Adapter & Out-of-Distribution Generalization Loader.
Supports the 6 neural vocoder architectures: MelGAN, Parallel WaveGAN, Multi-Band MelGAN,
HiFi-GAN, WaveGlow, FullSubNet.

STRICT POLICY: Never fabricates or fakes benchmark results. If the dataset files are not downloaded
locally at the configured directory, is_available() returns False and load_samples() returns [],
instructing the harness to report 'NOT EVALUATED'.
"""

import os
from pathlib import Path
from typing import List, Optional
import numpy as np
import scipy.io.wavfile as wavfile
from scipy import signal

from benchmarks.datasets.base import BenchmarkAudioSample, DatasetAdapter


class WaveFakeDatasetLoader(DatasetAdapter):
    """
    Adapter for RUB-SysSec/wavefake corpus.
    Folder structure:
      <wavefake_dir>/
        ├── ljspeech_melgan/
        ├── ljspeech_parallel_wavegan/
        ├── ljspeech_multi_band_melgan/
        ├── ljspeech_hifi_gan/
        ├── ljspeech_waveglow/
        ├── ljspeech_fullsubnet/
        └── ljspeech_real/ (or bona fide)
    """

    VOCODERS = [
        "melgan",
        "parallel_wavegan",
        "multi_band_melgan",
        "hifi_gan",
        "waveglow",
        "fullsubnet",
    ]

    def __init__(self, data_dir: Optional[Path] = None, target_sr: int = 16000):
        self.data_dir = Path(data_dir) if data_dir else Path(__file__).resolve().parent / "data"
        self.target_sr = target_sr

    def is_available(self) -> bool:
        """Return True only if local WaveFake audio files exist."""
        if not self.data_dir.exists():
            return False
        # Check if at least one vocoder subdirectory or audio files exist
        wav_count = len(list(self.data_dir.glob("**/*.wav")))
        return wav_count > 0

    def get_dataset_name(self) -> str:
        return "wavefake"

    def load_samples(self, limit: Optional[int] = None) -> List[BenchmarkAudioSample]:
        """
        Load samples from actual WaveFake audio files on disk.
        Returns empty list if files are not present.
        """
        if not self.is_available():
            return []

        samples: List[BenchmarkAudioSample] = []
        all_wavs = list(self.data_dir.glob("**/*.wav"))
        if limit:
            all_wavs = all_wavs[:limit]

        for wav_path in all_wavs:
            try:
                sr, audio_data = wavfile.read(str(wav_path))

                # Normalize to float32 [-1.0, 1.0]
                if audio_data.dtype == np.int16:
                    audio_float = audio_data.astype(np.float32) / 32768.0
                elif audio_data.dtype == np.int32:
                    audio_float = audio_data.astype(np.float32) / 2147483648.0
                else:
                    audio_float = audio_data.astype(np.float32)

                # Convert stereo to mono if necessary
                if audio_float.ndim > 1:
                    audio_float = np.mean(audio_float, axis=1)

                # Resample to canonical target_sr (16kHz)
                if sr != self.target_sr:
                    num_samples = int(len(audio_float) * (self.target_sr / sr))
                    audio_float = signal.resample(audio_float, num_samples).astype(np.float32)

                parent_name = wav_path.parent.name.lower()
                is_real = "real" in parent_name or "bonafide" in parent_name

                # Determine generator name
                gen_name = "human_natural"
                if not is_real:
                    for v in self.VOCODERS:
                        if v in parent_name:
                            gen_name = v
                            break

                samples.append(
                    BenchmarkAudioSample(
                        sample_id=wav_path.stem,
                        audio=audio_float,
                        sample_rate=self.target_sr,
                        is_synthetic=not is_real,
                        dataset_name="wavefake",
                        generator_name=gen_name,
                        speaker_id=None,
                        metadata={"source_file": str(wav_path.name), "original_sr": sr},
                    )
                )
            except Exception:
                continue

        return samples
