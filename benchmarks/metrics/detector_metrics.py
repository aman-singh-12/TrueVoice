"""
Deepfake Detection Metric Engine.
Computes Accuracy, Precision, Recall, F1, ROC-AUC, FPR, FNR, EER, and Confusion Matrix.
Never invents or fabricates numbers; yields 'NOT EVALUATED' on insufficient data.
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional, Tuple, Union
import numpy as np


@dataclass
class DeepfakeEvaluationMetrics:
    """Evaluated metric payload for audio deepfake classification."""

    sample_count: int
    positive_count: int  # Synthetic / spoof
    negative_count: int  # Authentic / bona fide
    threshold: float

    # Confusion matrix
    tp: int
    fp: int
    tn: int
    fn: int

    # Core metrics (float or 'NOT EVALUATED')
    accuracy: Union[float, str]
    precision: Union[float, str]
    recall: Union[float, str]
    f1_score: Union[float, str]
    fpr: Union[float, str]
    fnr: Union[float, str]
    roc_auc: Union[float, str]
    eer_percent: Union[float, str]
    eer_threshold: Union[float, str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DeepfakeMetricsCalculator:
    """
    Computes rigorous classification metrics from actual predictions and ground truth labels.
    Binary definition:
      y = 1: Synthetic / Spoof
      y = 0: Authentic / Bona Fide
    """

    @staticmethod
    def calculate(
        y_true: Union[List[int], np.ndarray],
        y_scores: Union[List[float], np.ndarray],
        decision_threshold: float = 50.0,
    ) -> DeepfakeEvaluationMetrics:
        """
        Evaluate classification metrics.
        Args:
            y_true: List or array of ground-truth binary labels (1 = synthetic, 0 = authentic).
            y_scores: Continuous synthetic risk scores, typically in [0.0, 100.0].
            decision_threshold: Operating cutoff above which audio is classified as synthetic.
        """
        y_true = np.asarray(y_true, dtype=np.int32)
        y_scores = np.asarray(y_scores, dtype=np.float64)

        n_samples = len(y_true)
        if n_samples == 0:
            return DeepfakeEvaluationMetrics(
                sample_count=0,
                positive_count=0,
                negative_count=0,
                threshold=decision_threshold,
                tp=0,
                fp=0,
                tn=0,
                fn=0,
                accuracy="NOT EVALUATED",
                precision="NOT EVALUATED",
                recall="NOT EVALUATED",
                f1_score="NOT EVALUATED",
                fpr="NOT EVALUATED",
                fnr="NOT EVALUATED",
                roc_auc="NOT EVALUATED",
                eer_percent="NOT EVALUATED",
                eer_threshold="NOT EVALUATED",
            )

        pos_count = int(np.sum(y_true == 1))
        neg_count = int(np.sum(y_true == 0))

        y_pred = (y_scores >= decision_threshold).astype(np.int32)
        tp = int(np.sum((y_pred == 1) & (y_true == 1)))
        fp = int(np.sum((y_pred == 1) & (y_true == 0)))
        tn = int(np.sum((y_pred == 0) & (y_true == 0)))
        fn = int(np.sum((y_pred == 0) & (y_true == 1)))

        acc = (tp + tn) / n_samples
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0

        fpr = fp / neg_count if neg_count > 0 else "NOT EVALUATED"
        fnr = fn / pos_count if pos_count > 0 else "NOT EVALUATED"

        # If only one class is present in y_true, ROC-AUC and EER cannot be computed mathematically
        if pos_count == 0 or neg_count == 0:
            auc_val = "NOT EVALUATED"
            eer_val = "NOT EVALUATED"
            eer_thresh = "NOT EVALUATED"
        else:
            auc_val = DeepfakeMetricsCalculator.compute_roc_auc(y_true, y_scores)
            eer_val, eer_thresh = DeepfakeMetricsCalculator.compute_eer(y_true, y_scores)

        return DeepfakeEvaluationMetrics(
            sample_count=n_samples,
            positive_count=pos_count,
            negative_count=neg_count,
            threshold=float(decision_threshold),
            tp=tp,
            fp=fp,
            tn=tn,
            fn=fn,
            accuracy=round(float(acc), 4),
            precision=round(float(prec), 4),
            recall=round(float(rec), 4),
            f1_score=round(float(f1), 4),
            fpr=round(float(fpr), 4) if isinstance(fpr, float) else fpr,
            fnr=round(float(fnr), 4) if isinstance(fnr, float) else fnr,
            roc_auc=round(float(auc_val), 4) if isinstance(auc_val, float) else auc_val,
            eer_percent=round(float(eer_val), 2) if isinstance(eer_val, float) else eer_val,
            eer_threshold=round(float(eer_thresh), 2) if isinstance(eer_thresh, float) else eer_thresh,
        )

    @staticmethod
    def compute_roc_auc(y_true: np.ndarray, y_scores: np.ndarray) -> float:
        """Calculate Area Under the ROC Curve (ROC-AUC) using trapezoidal numerical integration."""
        # Sort scores in descending order
        desc_indices = np.argsort(y_scores)[::-1]
        sorted_scores = y_scores[desc_indices]
        sorted_true = y_true[desc_indices]

        n_pos = np.sum(sorted_true == 1)
        n_neg = np.sum(sorted_true == 0)

        if n_pos == 0 or n_neg == 0:
            return 0.5

        # Unique threshold evaluation
        unique_scores, idx = np.unique(sorted_scores, return_index=True)
        # Keep descending order
        thresholds = sorted_scores[np.sort(idx)]

        tpr_list = [0.0]
        fpr_list = [0.0]

        for thresh in thresholds:
            tpr_list.append(float(np.sum((sorted_scores >= thresh) & (sorted_true == 1)) / n_pos))
            fpr_list.append(float(np.sum((sorted_scores >= thresh) & (sorted_true == 0)) / n_neg))

        tpr_list.append(1.0)
        fpr_list.append(1.0)

        # Trapezoidal numerical integration
        fpr_arr = np.asarray(fpr_list)
        tpr_arr = np.asarray(tpr_list)
        auc = float(np.trapezoid(tpr_arr, fpr_arr))
        return float(np.clip(auc, 0.0, 1.0))

    @staticmethod
    def compute_eer(y_true: np.ndarray, y_scores: np.ndarray) -> Tuple[float, float]:
        """
        Compute Equal Error Rate (EER) and operating threshold where FPR == FNR.
        Returns: (eer_percent, operating_threshold)
        """
        n_pos = np.sum(y_true == 1)
        n_neg = np.sum(y_true == 0)

        if n_pos == 0 or n_neg == 0:
            return 0.0, 50.0

        # Sweep thresholds
        min_score = float(np.min(y_scores))
        max_score = float(np.max(y_scores))
        if min_score == max_score:
            return 50.0, min_score

        thresholds = np.linspace(min_score - 1e-3, max_score + 1e-3, 500)
        best_diff = float("inf")
        best_eer = 0.0
        best_threshold = 50.0

        for thresh in thresholds:
            fpr = float(np.sum((y_scores >= thresh) & (y_true == 0)) / n_neg)
            fnr = float(np.sum((y_scores < thresh) & (y_true == 1)) / n_pos)
            diff = abs(fpr - fnr)

            if diff < best_diff:
                best_diff = diff
                best_eer = (fpr + fnr) / 2.0 * 100.0
                best_threshold = float(thresh)

        return float(best_eer), float(best_threshold)
