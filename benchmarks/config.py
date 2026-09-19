"""
Benchmark Suite Configuration & Degradation Presets.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional


@dataclass
class BenchmarkConfig:
    """Settings controlling offline benchmark execution."""

    # Default paths
    workspace_root: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent)
    wavefake_data_dir: Path = field(
        default_factory=lambda: Path(__file__).resolve().parent / "datasets" / "wavefake" / "data"
    )
    asvspoof_data_dir: Path = field(
        default_factory=lambda: Path(__file__).resolve().parent / "datasets" / "asvspoof" / "data"
    )
    output_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent)

    # Signal definitions
    sample_rate: int = 16000
    canonical_window_seconds: float = 2.0
    hop_seconds: float = 0.5

    # Evaluation targets
    eer_target_clean: float = 3.5  # <= 3.5% EER target on clean speech
    eer_target_unseen: float = 7.0  # <= 7.0% EER target on unseen vocoders
    auc_target: float = 0.96  # >= 0.96 AUC
    latency_p95_gpu_target_ms: float = 80.0
    latency_p95_cpu_target_ms: float = 120.0

    # Supported candidate detectors
    candidate_detectors: List[str] = field(
        default_factory=lambda: ["mock", "wav2vec2", "rawnet2", "aasist"]
    )

    # Standard benchmark condition names
    conditions: List[str] = field(
        default_factory=lambda: [
            "clean",
            "noise_awgn_10db",
            "noise_awgn_0db",
            "volume_attenuate_12db",
            "volume_boost_6db",
            "telephony_bandpass_300_3400hz",
            "codec_g711_mulaw",
            "codec_resampled_8khz",
            "clipping_saturated",
            "short_audio_0_25s",
            "short_audio_0_5s",
            "digital_silence",
        ]
    )

    # WaveFake vocoder architectures
    wavefake_vocoders: List[str] = field(
        default_factory=lambda: [
            "melgan",
            "parallel_wavegan",
            "multi_band_melgan",
            "hifi_gan",
            "waveglow",
            "fullsubnet",
        ]
    )
