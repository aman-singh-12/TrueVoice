"""
TrueVoice Benchmark CLI Runner & Evaluation Orchestrator.
Executes candidate deepfake detectors against clean and degraded acoustic conditions
using their actual public interface (DeepfakeDetector.predict).
Measures latency (P50, P95), calculates classification metrics, and exports reports.
"""

import asyncio
import argparse
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

# Ensure backend directory is in sys.path for standalone CLI execution
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import numpy as np

from benchmarks.config import BenchmarkConfig
from benchmarks.metrics.detector_metrics import DeepfakeMetricsCalculator
from benchmarks.metrics.latency_profiler import LatencyProfiler
from benchmarks.augmentations.codec_simulator import CodecSimulator
from benchmarks.augmentations.acoustic_perturbations import AcousticPerturbations
from benchmarks.datasets.reference_generator import ReferenceAudioGenerator
from benchmarks.datasets.wavefake.loader import WaveFakeDatasetLoader
from benchmarks.datasets.asvspoof.loader import ASVspoofDatasetLoader
from benchmarks.reports.reporter import BenchmarkReporter, ConditionBenchmarkResult


class BenchmarkRunner:
    """Orchestrates offline benchmark evaluation across detectors, datasets, and conditions."""

    def __init__(self, config: Optional[BenchmarkConfig] = None):
        self.config = config or BenchmarkConfig()
        self.reporter = BenchmarkReporter(output_dir=self.config.output_dir)
        self.reference_gen = ReferenceAudioGenerator(sample_rate=self.config.sample_rate)
        self.wavefake_loader = WaveFakeDatasetLoader(data_dir=self.config.wavefake_data_dir)
        self.asvspoof_loader = ASVspoofDatasetLoader(data_dir=self.config.asvspoof_data_dir)

    def resolve_detector(self, detector_name: str):
        """Load detector via public TrueVoice DetectorRegistry / factory."""
        from app.detectors.mock import MockDeepfakeDetector
        from app.detectors.wav2vec2.detector import Wav2Vec2Detector
        from app.detectors.rawnet2.detector import RawNet2Detector
        from app.detectors.aasist.detector import AASISTDetector

        name = detector_name.lower()
        if name == "mock":
            detector = MockDeepfakeDetector()
        elif name == "wav2vec2":
            detector = Wav2Vec2Detector()
        elif name == "rawnet2":
            detector = RawNet2Detector()
        elif name == "aasist":
            detector = AASISTDetector()
        else:
            raise ValueError(f"Unknown detector '{detector_name}'. Choose from {self.config.candidate_detectors}")

        detector.load_model(device="cpu")
        return detector

    def apply_condition(self, audio: np.ndarray, condition: str) -> np.ndarray:
        """Apply specified acoustic or codec degradation transform."""
        if condition == "clean":
            return audio.copy()
        elif condition == "noise_awgn_10db":
            return AcousticPerturbations.add_awgn(audio, snr_db=10.0)
        elif condition == "noise_awgn_0db":
            return AcousticPerturbations.add_awgn(audio, snr_db=0.0)
        elif condition == "volume_attenuate_12db":
            return AcousticPerturbations.scale_volume_db(audio, gain_db=-12.0)
        elif condition == "volume_boost_6db":
            return AcousticPerturbations.scale_volume_db(audio, gain_db=6.0)
        elif condition == "telephony_bandpass_300_3400hz":
            return CodecSimulator.telephony_bandpass(audio, sample_rate=self.config.sample_rate)
        elif condition == "codec_g711_mulaw":
            return CodecSimulator.g711_mulaw_transcode(audio)
        elif condition == "codec_resampled_8khz":
            return CodecSimulator.resample_narrowband(audio)
        elif condition == "clipping_saturated":
            return AcousticPerturbations.apply_clipping(audio, threshold=0.4)
        elif condition == "short_audio_0_25s":
            return AcousticPerturbations.truncate_duration(audio, target_seconds=0.25)
        elif condition == "short_audio_0_5s":
            return AcousticPerturbations.truncate_duration(audio, target_seconds=0.5)
        elif condition == "digital_silence":
            return AcousticPerturbations.generate_silence(duration_seconds=2.0)
        else:
            return audio.copy()

    async def evaluate_condition(
        self,
        detector,
        samples,
        dataset_name: str,
        condition: str,
        generator_name: str = "mixed",
        noise_type: Optional[str] = None,
        codec: Optional[str] = None,
    ) -> ConditionBenchmarkResult:
        """Run detector predictions across samples and profile latency."""
        profiler = LatencyProfiler()
        y_true: List[int] = []
        y_scores: List[float] = []

        for sample in samples:
            # 1. Preprocess & augment
            t0 = time.perf_counter()
            degraded_audio = self.apply_condition(sample.audio, condition)
            t_prep = (time.perf_counter() - t0) * 1000.0
            profiler.record_stage("preprocessing", t_prep)

            # 2. Public detector interface inference
            t1 = time.perf_counter()
            result = await detector.predict(degraded_audio, sample_rate=self.config.sample_rate)
            t_inf = (time.perf_counter() - t1) * 1000.0
            profiler.record_stage("deepfake_inference", t_inf)
            profiler.record_stage("total_window", t_prep + t_inf)

            y_true.append(1 if sample.is_synthetic else 0)
            y_scores.append(float(result.score))

        metrics = DeepfakeMetricsCalculator.calculate(y_true, y_scores, decision_threshold=50.0)
        lat_report = profiler.generate_report()

        total_lat = lat_report.stages.get("total_window")
        lat_summary = {
            "p50_ms": total_lat.p50_ms if total_lat else 0.0,
            "p95_ms": total_lat.p95_ms if total_lat else 0.0,
            "mean_ms": total_lat.mean_ms if total_lat else 0.0,
            "device": lat_report.device_type,
        }

        return ConditionBenchmarkResult(
            model_name=detector.get_model_name(),
            model_version=detector.get_model_version(),
            dataset=dataset_name,
            condition=condition,
            generator=generator_name,
            noise_type=noise_type,
            codec=codec,
            sample_duration_seconds=self.config.canonical_window_seconds,
            sample_count=len(samples),
            metrics=metrics.to_dict(),
            latency=lat_summary,
        )

    async def run(
        self,
        detectors: Optional[List[str]] = None,
        conditions: Optional[List[str]] = None,
        sample_limit: int = 16,
    ) -> Dict[str, Any]:
        """Execute the full benchmark matrix."""
        selected_detectors = detectors or ["mock"]
        selected_conditions = conditions or [
            "clean",
            "noise_awgn_10db",
            "telephony_bandpass_300_3400hz",
            "codec_g711_mulaw",
            "clipping_saturated",
            "short_audio_0_5s",
        ]

        print(f"=== TrueVoice Offline Benchmark Suite ===")
        print(f"Detectors: {selected_detectors}")
        print(f"Conditions: {selected_conditions}\n")

        # 1. Calibrated reference dataset
        ref_samples = self.reference_gen.load_samples(limit=sample_limit)

        for det_name in selected_detectors:
            detector = self.resolve_detector(det_name)
            print(f"-> Evaluating Model: {detector.get_model_name()} ({detector.get_model_version()})")

            for cond in selected_conditions:
                noise_type = "AWGN" if "noise" in cond else None
                codec = "G.711" if "g711" in cond else ("Bandpass 300-3400Hz" if "telephony" in cond else None)

                res = await self.evaluate_condition(
                    detector=detector,
                    samples=ref_samples,
                    dataset_name="calibrated_reference",
                    condition=cond,
                    generator_name="synthetic_speech_simulation",
                    noise_type=noise_type,
                    codec=codec,
                )
                self.reporter.add_result(res)
                print(
                    f"   [{cond:30s}] Samples={res.sample_count:2d} | "
                    f"Acc={res.metrics.get('accuracy')} | "
                    f"AUC={res.metrics.get('roc_auc')} | "
                    f"EER={res.metrics.get('eer_percent')}% | "
                    f"P95 Latency={res.latency.get('p95_ms')}ms"
                )

            # 2. WaveFake evaluation (Part B)
            if self.wavefake_loader.is_available():
                print("   -> Running WaveFake Generalization...")
                wf_samples = self.wavefake_loader.load_samples(limit=sample_limit)
                wf_res = await self.evaluate_condition(
                    detector=detector,
                    samples=wf_samples,
                    dataset_name="wavefake",
                    condition="clean",
                    generator_name="unseen_neural_vocoders",
                )
                self.reporter.add_result(wf_res)
            else:
                # Strictly report NOT EVALUATED rather than fabricating
                self.reporter.add_result(
                    ConditionBenchmarkResult(
                        model_name=detector.get_model_name(),
                        model_version=detector.get_model_version(),
                        dataset="wavefake",
                        condition="clean",
                        generator="unseen_neural_vocoders",
                        noise_type=None,
                        codec=None,
                        sample_duration_seconds=self.config.canonical_window_seconds,
                        sample_count=0,
                        metrics={
                            "accuracy": "NOT EVALUATED (Local dataset files not found)",
                            "f1_score": "NOT EVALUATED",
                            "roc_auc": "NOT EVALUATED",
                            "eer_percent": "NOT EVALUATED",
                        },
                        latency={"p50_ms": "N/A", "p95_ms": "N/A"},
                    )
                )

            # 3. ASVspoof evaluation (Part C)
            if self.asvspoof_loader.is_available():
                print("   -> Running ASVspoof Logical Access...")
                asv_samples = self.asvspoof_loader.load_samples(limit=sample_limit)
                asv_res = await self.evaluate_condition(
                    detector=detector,
                    samples=asv_samples,
                    dataset_name="asvspoof2019_la",
                    condition="clean",
                    generator_name="asvspoof_attacks",
                )
                self.reporter.add_result(asv_res)
            else:
                self.reporter.add_result(
                    ConditionBenchmarkResult(
                        model_name=detector.get_model_name(),
                        model_version=detector.get_model_version(),
                        dataset="asvspoof2019_la",
                        condition="clean",
                        generator="asvspoof_attacks",
                        noise_type=None,
                        codec=None,
                        sample_duration_seconds=self.config.canonical_window_seconds,
                        sample_count=0,
                        metrics={
                            "accuracy": "NOT EVALUATED (Local dataset files not found)",
                            "f1_score": "NOT EVALUATED",
                            "roc_auc": "NOT EVALUATED",
                            "eer_percent": "NOT EVALUATED",
                        },
                        latency={"p50_ms": "N/A", "p95_ms": "N/A"},
                    )
                )

        json_file = self.reporter.export_json("benchmark_results.json")
        md_file = self.reporter.export_markdown("benchmark_summary.md")
        print(f"\n[Done] Benchmark exported to:\n  - {json_file}\n  - {md_file}")
        return {"json_path": str(json_file), "md_path": str(md_file)}


def main():
    parser = argparse.ArgumentParser(description="TrueVoice Offline Benchmark Runner")
    parser.add_argument("--detector", type=str, default="mock", help="Detector model: mock, wav2vec2, rawnet2, aasist")
    parser.add_argument("--samples", type=int, default=16, help="Number of samples to evaluate per condition")
    parser.add_argument("--output-json", type=str, default="benchmark_results.json", help="JSON output file name")
    parser.add_argument("--output-md", type=str, default="benchmark_summary.md", help="Markdown output file name")
    args = parser.parse_args()

    runner = BenchmarkRunner()
    asyncio.run(runner.run(detectors=[args.detector], sample_limit=args.samples))


if __name__ == "__main__":
    main()
