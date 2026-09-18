"""
Benchmark Report Generator & Exporter.
Serializes structured evaluation results to JSON (benchmark_results.json)
and formats a clean Markdown summary table with cross-condition groupings.
"""

import json
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Any, List, Optional

from benchmarks.metrics.detector_metrics import DeepfakeEvaluationMetrics
from benchmarks.metrics.latency_profiler import LatencyReport


@dataclass
class ConditionBenchmarkResult:
    """Benchmark outcome for a specific model under a specific acoustic condition."""

    model_name: str
    model_version: str
    dataset: str
    condition: str
    generator: str
    noise_type: Optional[str]
    codec: Optional[str]
    sample_duration_seconds: float
    sample_count: int
    metrics: Dict[str, Any]
    latency: Dict[str, Any]


class BenchmarkReporter:
    """
    Manages collection, JSON formatting, and Markdown generation of benchmark results.
    """

    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = Path(output_dir) if output_dir else Path.cwd()
        self.results: List[ConditionBenchmarkResult] = []
        self.metadata: Dict[str, Any] = {
            "benchmark_suite": "TrueVoice Offline Benchmark",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "execution_environment": {},
        }

    def add_result(self, result: ConditionBenchmarkResult) -> None:
        self.results.append(result)

    def set_environment_info(self, env_info: Dict[str, Any]) -> None:
        self.metadata["execution_environment"] = env_info

    def export_json(self, filename: str = "benchmark_results.json") -> Path:
        """Export full machine-readable JSON."""
        target_path = self.output_dir / filename
        payload = {
            "metadata": self.metadata,
            "total_evaluations": len(self.results),
            "results": [asdict(r) for r in self.results],
        }
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        return target_path

    def export_markdown(self, filename: str = "benchmark_summary.md") -> Path:
        """Generate human-readable Markdown summary report with cross-condition matrix."""
        target_path = self.output_dir / filename
        lines = [
            "# TrueVoice Benchmark & Robustness Summary Report",
            "",
            f"**Generated:** {self.metadata['timestamp']}  ",
            f"**Environment Device:** {self.metadata.get('execution_environment', {}).get('device', 'CPU')}  ",
            f"**Total Evaluations Run:** {len(self.results)}",
            "",
            "## 1. Cross-Condition Performance Matrix",
            "",
            "| Model | Dataset | Condition | Generator | Codec / Noise | Samples | Accuracy | F1 Score | ROC-AUC | EER (%) | Latency P50 | Latency P95 |",
            "| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
        ]

        for r in self.results:
            m = r.metrics
            lat = r.latency
            p50 = f"{lat.get('p50_ms', 'N/A')}ms" if isinstance(lat, dict) and "p50_ms" in lat else "N/A"
            p95 = f"{lat.get('p95_ms', 'N/A')}ms" if isinstance(lat, dict) and "p95_ms" in lat else "N/A"

            acc_str = str(m.get("accuracy", "N/A"))
            f1_str = str(m.get("f1_score", "N/A"))
            auc_str = str(m.get("roc_auc", "N/A"))
            eer_str = str(m.get("eer_percent", "N/A"))

            codec_noise = r.codec or r.noise_type or "None"

            lines.append(
                f"| **{r.model_name}** | {r.dataset} | `{r.condition}` | {r.generator} | {codec_noise} | "
                f"{r.sample_count} | {acc_str} | {f1_str} | {auc_str} | {eer_str} | {p50} | {p95} |"
            )

        lines.extend([
            "",
            "## 2. Integrity & Evaluation Notes",
            "- **Zero Fabrication**: If a dataset (e.g. WaveFake full corpus) is not installed locally, metrics explicitly state `NOT EVALUATED`.",
            "- **Latency Standard**: Target latency is $P95 \\le 80\\text{ms}$ on GPU, $P95 \\le 120\\text{ms}$ on CPU for a canonical analysis window.",
            "- **Model Interface**: All tests executed strictly through the public `DeepfakeDetector.predict()` interface without altering production weights.",
            "",
        ])

        with open(target_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return target_path
