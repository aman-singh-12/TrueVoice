"""
Speaker Verification Biometric Metrics Engine.
Computes False Acceptance Rate (FAR), False Rejection Rate (FRR), EER, ROC-AUC, and operating threshold.
Yields 'NOT EVALUATED' on insufficient data.
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Tuple, Union
import numpy as np


@dataclass
class SpeakerEvaluationMetrics:
    """Biometric evaluation metrics for speaker verification."""

    trial_count: int
    target_count: int  # Genuine speaker pairs (label = 1)
    impostor_count: int  # Impostor speaker pairs (label = 0)
    operating_threshold: float

    far: Union[float, str]  # False Acceptance Rate
    frr: Union[float, str]  # False Rejection Rate
    eer_percent: Union[float, str]  # Equal Error Rate (%)
    eer_threshold: Union[float, str]
    roc_auc: Union[float, str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SpeakerMetricsCalculator:
    """
    Evaluates speaker verification accuracy across target (genuine) and non-target (impostor) pairs.
    """

    @staticmethod
    def calculate(
        y_true: Union[List[int], np.ndarray],
        similarities: Union[List[float], np.ndarray],
        operating_threshold: float = 0.75,
    ) -> SpeakerEvaluationMetrics:
        """
        Evaluate biometric verification metrics.
        Args:
            y_true: 1 for genuine/enrolled target speaker, 0 for impostor.
            similarities: Cosine similarities, typically in [-1.0, 1.0] or [0.0, 1.0].
            operating_threshold: Threshold above which two samples are declared the same speaker.
        """
        y_true = np.asarray(y_true, dtype=np.int32)
        similarities = np.asarray(similarities, dtype=np.float64)

        n_trials = len(y_true)
        if n_trials == 0:
            return SpeakerEvaluationMetrics(
                trial_count=0,
                target_count=0,
                impostor_count=0,
                operating_threshold=operating_threshold,
                far="NOT EVALUATED",
                frr="NOT EVALUATED",
                eer_percent="NOT EVALUATED",
                eer_threshold="NOT EVALUATED",
                roc_auc="NOT EVALUATED",
            )

        n_target = int(np.sum(y_true == 1))
        n_impostor = int(np.sum(y_true == 0))

        # Check for single-class trials
        if n_target == 0 or n_impostor == 0:
            return SpeakerEvaluationMetrics(
                trial_count=n_trials,
                target_count=n_target,
                impostor_count=n_impostor,
                operating_threshold=operating_threshold,
                far="NOT EVALUATED",
                frr="NOT EVALUATED",
                eer_percent="NOT EVALUATED",
                eer_threshold="NOT EVALUATED",
                roc_auc="NOT EVALUATED",
            )

        # Compute FAR and FRR at operating threshold
        # Impostors accepted (sim >= threshold)
        fa = int(np.sum((similarities >= operating_threshold) & (y_true == 0)))
        # Genuine rejected (sim < threshold)
        fr = int(np.sum((similarities < operating_threshold) & (y_true == 1)))

        far = fa / n_impostor
        frr = fr / n_target

        # Sweep thresholds for EER and ROC-AUC
        eer_val, eer_thresh = SpeakerMetricsCalculator.compute_eer(y_true, similarities)
        auc_val = SpeakerMetricsCalculator.compute_auc(y_true, similarities)

        return SpeakerEvaluationMetrics(
            trial_count=n_trials,
            target_count=n_target,
            impostor_count=n_impostor,
            operating_threshold=float(operating_threshold),
            far=round(float(far), 4),
            frr=round(float(frr), 4),
            eer_percent=round(float(eer_val), 2),
            eer_threshold=round(float(eer_thresh), 4),
            roc_auc=round(float(auc_val), 4),
        )

    @staticmethod
    def compute_eer(y_true: np.ndarray, similarities: np.ndarray) -> Tuple[float, float]:
        n_pos = np.sum(y_true == 1)
        n_neg = np.sum(y_true == 0)

        min_sim = float(np.min(similarities))
        max_sim = float(np.max(similarities))
        if min_sim == max_sim:
            return 50.0, min_sim

        thresholds = np.linspace(min_sim - 1e-4, max_sim + 1e-4, 500)
        best_diff = float("inf")
        best_eer = 0.0
        best_thresh = 0.75

        for th in thresholds:
            far = float(np.sum((similarities >= th) & (y_true == 0)) / n_neg)
            frr = float(np.sum((similarities < th) & (y_true == 1)) / n_pos)
            diff = abs(far - frr)
            if diff < best_diff:
                best_diff = diff
                best_eer = (far + frr) / 2.0 * 100.0
                best_thresh = float(th)

        return float(best_eer), float(best_thresh)

    @staticmethod
    def compute_auc(y_true: np.ndarray, similarities: np.ndarray) -> float:
        desc_indices = np.argsort(similarities)[::-1]
        sorted_sim = similarities[desc_indices]
        sorted_true = y_true[desc_indices]

        n_pos = np.sum(sorted_true == 1)
        n_neg = np.sum(sorted_true == 0)

        thresholds, idx = np.unique(sorted_sim, return_index=True)
        thresholds = sorted_sim[np.sort(idx)]

        tpr_list = [0.0]
        fpr_list = [0.0]

        for th in thresholds:
            tpr_list.append(float(np.sum((sorted_sim >= th) & (sorted_true == 1)) / n_pos))
            fpr_list.append(float(np.sum((sorted_sim >= th) & (sorted_true == 0)) / n_neg))

        tpr_list.append(1.0)
        fpr_list.append(1.0)

        auc = float(np.trapezoid(np.asarray(tpr_list), np.asarray(fpr_list)))
        return float(np.clip(auc, 0.0, 1.0))
