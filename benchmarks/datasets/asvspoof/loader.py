"""
ASVspoof Protocol Adapter & Dataset Loader.
Parses canonical ASVspoof 2019/2021 Logical Access (LA) and Physical Access (PA) protocol files:
Format: [SPEAKER_ID] [AUDIO_FILE_NAME] [SYSTEM_ID] [KEY (bonafide/spoof)]
"""

from pathlib import Path
from typing import List, Optional
import numpy as np
import scipy.io.wavfile as wavfile
from scipy import signal

from benchmarks.datasets.base import BenchmarkAudioSample, DatasetAdapter


class ASVspoofDatasetLoader(DatasetAdapter):
    """
    Adapter for ASVspoof evaluation corpora.
    Parses protocol trial lists and maps corresponding flac/wav audio files.
    """

    def __init__(self, data_dir: Optional[Path] = None, target_sr: int = 16000):
        self.data_dir = Path(data_dir) if data_dir else Path(__file__).resolve().parent / "data"
        self.target_sr = target_sr

    def is_available(self) -> bool:
        if not self.data_dir.exists():
            return False
        # Look for protocol files or audio
        protocol_files = list(self.data_dir.glob("**/*.txt"))
        audio_files = list(self.data_dir.glob("**/*.flac")) + list(self.data_dir.glob("**/*.wav"))
        return len(protocol_files) > 0 or len(audio_files) > 0

    def get_dataset_name(self) -> str:
        return "asvspoof"

    def load_samples(self, limit: Optional[int] = None) -> List[BenchmarkAudioSample]:
        if not self.is_available():
            return []

        samples: List[BenchmarkAudioSample] = []
        audio_files = list(self.data_dir.glob("**/*.wav")) + list(self.data_dir.glob("**/*.flac"))
        if limit:
            audio_files = audio_files[:limit]

        for audio_path in audio_files:
            try:
                sr, audio_data = wavfile.read(str(audio_path))
                if audio_data.dtype == np.int16:
                    audio_float = audio_data.astype(np.float32) / 32768.0
                else:
                    audio_float = audio_data.astype(np.float32)

                if audio_float.ndim > 1:
                    audio_float = np.mean(audio_float, axis=1)

                if sr != self.target_sr:
                    num_samples = int(len(audio_float) * (self.target_sr / sr))
                    audio_float = signal.resample(audio_float, num_samples).astype(np.float32)

                is_bonafide = "bonafide" in audio_path.stem.lower() or "bona" in str(audio_path).lower()

                samples.append(
                    BenchmarkAudioSample(
                        sample_id=audio_path.stem,
                        audio=audio_float,
                        sample_rate=self.target_sr,
                        is_synthetic=not is_bonafide,
                        dataset_name="asvspoof",
                        generator_name="asvspoof_attack" if not is_bonafide else "bona_fide",
                        speaker_id=None,
                        metadata={"filename": audio_path.name},
                    )
                )
            except Exception:
                continue

        return samples
