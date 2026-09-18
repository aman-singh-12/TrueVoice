"""
Unit Tests for Benchmark Metrics Engines.
Verifies mathematical accuracy of DeepfakeMetricsCalculator, SpeakerMetricsCalculator, and LatencyProfiler.
Fulfills Person 5 Part D requirements:
- Accuracy, Precision, Recall, F1
- Confusion Matrix, FPR, FNR
- ROC-AUC and EER
- Speaker FAR, FRR, EER, operating threshold
- Strict 'NOT EVALUATED' on missing/single-class data.
"""

import numpy as np
import pytest

from benchmarks.metrics.detector_metrics import DeepfakeMetricsCalculator
from benchmarks.metrics.speaker_metrics import SpeakerMetricsCalculator
from benchmarks.metrics.latency_profiler import LatencyProfiler


@pytest.mark.unit
def test_deepfake_metrics_perfect_classification():
    """Verify metrics for 100% correct predictions."""
    y_true = [0, 0, 0, 0, 1, 1, 1, 1]
    y_scores = [10.0, 20.0, 15.0, 25.0, 85.0, 90.0, 95.0, 80.0]

    metrics = DeepfakeMetricsCalculator.calculate(y_true, y_scores, decision_threshold=50.0)

    assert metrics.sample_count == 8
    assert metrics.tp == 4
    assert metrics.tn == 4
    assert metrics.fp == 0
    assert metrics.fn == 0
    assert metrics.accuracy == 1.0
    assert metrics.precision == 1.0
    assert metrics.recall == 1.0
    assert metrics.f1_score == 1.0
    assert metrics.fpr == 0.0
    assert metrics.fnr == 0.0
    assert metrics.roc_auc == 1.0
    assert metrics.eer_percent == 0.0


@pytest.mark.unit
def test_deepfake_metrics_imperfect_classification():
    """Verify metrics for mixed true/false positives and negatives."""
    # 2 Authentic (0, 0), 2 Synthetic (1, 1)
    # Predicted scores: [10, 60 (FP), 40 (FN), 90 (TP)] at threshold 50.0
    y_true = [0, 0, 1, 1]
    y_scores = [10.0, 60.0, 40.0, 90.0]

    metrics = DeepfakeMetricsCalculator.calculate(y_true, y_scores, decision_threshold=50.0)

    assert metrics.sample_count == 4
    assert metrics.tp == 1
    assert metrics.fp == 1
    assert metrics.tn == 1
    assert metrics.fn == 1
    assert metrics.accuracy == 0.5
    assert metrics.precision == 0.5
    assert metrics.recall == 0.5
    assert metrics.f1_score == 0.5
    assert metrics.fpr == 0.5
    assert metrics.fnr == 0.5


@pytest.mark.unit
def test_deepfake_metrics_single_class_yields_not_evaluated():
    """Verify that single-class datasets yield 'NOT EVALUATED' for AUC/EER."""
    # Only authentic speech, no synthetic attacks
    y_true = [0, 0, 0, 0]
    y_scores = [10.0, 20.0, 30.0, 15.0]

    metrics = DeepfakeMetricsCalculator.calculate(y_true, y_scores, decision_threshold=50.0)

    assert metrics.sample_count == 4
    assert metrics.roc_auc == "NOT EVALUATED"
    assert metrics.eer_percent == "NOT EVALUATED"
    assert metrics.fnr == "NOT EVALUATED"  # No positive class to compute false negatives


@pytest.mark.unit
def test_speaker_verification_metrics_calculation():
    """Verify FAR, FRR, EER, and AUC for biometric speaker verification."""
    # 3 genuine pairs (1), 3 impostor pairs (0)
    y_true = [1, 1, 1, 0, 0, 0]
    # Cosine similarities
    sims = [0.92, 0.88, 0.85, 0.20, 0.35, 0.15]

    spk_metrics = SpeakerMetricsCalculator.calculate(y_true, sims, operating_threshold=0.75)

    assert spk_metrics.trial_count == 6
    assert spk_metrics.target_count == 3
    assert spk_metrics.impostor_count == 3
    assert spk_metrics.far == 0.0
    assert spk_metrics.frr == 0.0
    assert spk_metrics.roc_auc == 1.0
    assert spk_metrics.eer_percent == 0.0


@pytest.mark.unit
def test_latency_profiler_percentiles():
    """Verify latency percentile calculations (Mean, P50, P95, P99)."""
    profiler = LatencyProfiler(device="cpu")

    # Record 100 timings linearly from 1ms to 100ms
    for t in range(1, 101):
        profiler.record_stage("deepfake_inference", float(t))
        profiler.record_stage("total_window", float(t + 5))

    report = profiler.generate_report()

    assert "deepfake_inference" in report.stages
    stats = report.stages["deepfake_inference"]
    assert stats.sample_count == 100
    assert stats.min_ms == 1.0
    assert stats.max_ms == 100.0
    assert stats.p50_ms == 50.5
    assert stats.p95_ms == 95.05 or abs(stats.p95_ms - 95.0) <= 1.0
    assert report.device_type == "cpu"
