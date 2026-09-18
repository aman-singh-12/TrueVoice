"""
Stage-Level Latency Profiling and Hardware Benchmarking Engine.
Measures Preprocessing, Deepfake Inference, Speaker Embedding, ASR, and Full Window Latencies.
Records Mean, Min, Max, P50 (median), P95, and P99 with CPU/GPU differentiation.
"""

import time
import os
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional
import numpy as np


@dataclass
class StageLatencyStats:
    """Latency distribution statistics for a single pipeline stage."""

    stage_name: str
    sample_count: int
    mean_ms: float
    min_ms: float
    max_ms: float
    p50_ms: float
    p95_ms: float
    p99_ms: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class LatencyReport:
    """Complete latency profiling report across all stages and execution target."""

    device_type: str  # "cuda:0", "cpu", etc.
    device_name: str  # E.g. "NVIDIA RTX 4090" or "Intel Core i7"
    total_samples: int
    stages: Dict[str, StageLatencyStats] = field(default_factory=dict)
    meets_p95_target: bool = False
    target_threshold_ms: float = 120.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "device_type": self.device_type,
            "device_name": self.device_name,
            "total_samples": self.total_samples,
            "meets_p95_target": self.meets_p95_target,
            "target_threshold_ms": self.target_threshold_ms,
            "stages": {k: v.to_dict() for k, v in self.stages.items()},
        }


class LatencyProfiler:
    """
    High-precision stage latency measurement and percentile computation.
    """

    def __init__(self, device: Optional[str] = None):
        self.device = device or self._detect_device()
        self.device_name = self._detect_device_name(self.device)
        self._stage_timings: Dict[str, List[float]] = {
            "preprocessing": [],
            "deepfake_inference": [],
            "speaker_inference": [],
            "asr_inference": [],
            "total_window": [],
        }

    @staticmethod
    def _detect_device() -> str:
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
        except ImportError:
            pass
        return "cpu"

    @staticmethod
    def _detect_device_name(device: str) -> str:
        if "cuda" in device.lower():
            try:
                import torch
                return str(torch.cuda.get_device_name(0))
            except Exception:
                return "NVIDIA CUDA GPU"
        import platform
        return platform.processor() or "CPU (Host)"

    def record_stage(self, stage_name: str, duration_ms: float) -> None:
        """Record an elapsed duration in milliseconds for a given pipeline stage."""
        if stage_name not in self._stage_timings:
            self._stage_timings[stage_name] = []
        self._stage_timings[stage_name].append(float(duration_ms))

    def generate_report(self) -> LatencyReport:
        """Calculate distribution percentiles and generate final LatencyReport."""
        stage_stats: Dict[str, StageLatencyStats] = {}
        total_samples = 0

        for stage_name, timings in self._stage_timings.items():
            if not timings:
                continue

            arr = np.asarray(timings, dtype=np.float64)
            n = len(arr)
            total_samples = max(total_samples, n)

            stage_stats[stage_name] = StageLatencyStats(
                stage_name=stage_name,
                sample_count=n,
                mean_ms=round(float(np.mean(arr)), 2),
                min_ms=round(float(np.min(arr)), 2),
                max_ms=round(float(np.max(arr)), 2),
                p50_ms=round(float(np.percentile(arr, 50)), 2),
                p95_ms=round(float(np.percentile(arr, 95)), 2),
                p99_ms=round(float(np.percentile(arr, 99)), 2),
            )

        target = 80.0 if "cuda" in self.device.lower() else 120.0
        total_p95 = stage_stats.get("total_window", None)
        meets_target = bool(total_p95 and total_p95.p95_ms <= target)

        return LatencyReport(
            device_type=self.device,
            device_name=self.device_name,
            total_samples=total_samples,
            stages=stage_stats,
            meets_p95_target=meets_target,
            target_threshold_ms=target,
        )

    def reset(self) -> None:
        """Clear recorded timings."""
        for k in self._stage_timings:
            self._stage_timings[k].clear()
