"""
Acoustic Forensics Analyzer.
Strictly decouples physical feature extraction from decision scoring:
Raw Forensic Audio -> Feature Extraction Layer -> Features Dictionary -> Forensic Scoring Layer -> S_forensic.
Thresholds are configurable heuristic baselines, not universal constants.
"""

from typing import Any, Dict, Tuple
import numpy as np

from app.config import settings
from app.core.constants import SignalAvailability
from app.forensics.f0 import extract_f0_contour
from app.forensics.jitter import compute_jitter_local
from app.forensics.shimmer import compute_shimmer_local
from app.forensics.hnr import compute_hnr_db
from app.forensics.spectral import compute_spectral_features


class ForensicResult:
    """Carries extracted forensic features and calibrated anomaly score."""

    def __init__(
        self,
        score: float,
        features: Dict[str, Any],
        signal_availability: SignalAvailability = SignalAvailability.AVAILABLE,
    ):
        self.score = score  # 0.0 to 100.0 (0=natural acoustic, 100=highly anomalous)
        self.features = features
        self.signal_availability = signal_availability


class ForensicAnalyzer:
    """Orchestrator for deterministic physical acoustic voice analysis."""

    def __init__(
        self,
        f0_step_threshold_hz: float = settings.FORENSIC_F0_STEP_HZ,
        jitter_min: float = settings.FORENSIC_JITTER_MAX,
        shimmer_min: float = settings.FORENSIC_SHIMMER_MAX,
        hnr_min_db: float = settings.FORENSIC_HNR_MIN_DB,
    ):
        # Heuristic baseline parameters (configurable per tenant policy)
        self.f0_step_threshold_hz = f0_step_threshold_hz
        self.jitter_min = jitter_min
        self.shimmer_min = shimmer_min
        self.hnr_min_db = hnr_min_db

    def extract_features(self, raw_audio: np.ndarray, sample_rate: int = 16000) -> Dict[str, Any]:
        """
        Stage 1: Extract pure physical signal measurements without scoring.
        Preserves raw values independently for telemetry and explainability.
        """
        if len(raw_audio) < 800:
            return {
                "mean_f0_hz": 0.0,
                "max_pitch_jump_hz": 0.0,
                "jitter_local": 0.0,
                "shimmer_local": 0.0,
                "hnr_db": 0.0,
                "spectral_flatness": 0.0,
                "spectral_flux": 0.0,
                "voiced_ratio": 0.0,
            }

        # 1. Pitch & F0 tracking
        f0_contour, mean_f0, max_jump = extract_f0_contour(raw_audio, sample_rate=sample_rate)
        voiced_count = np.count_nonzero(f0_contour > 0.0)
        voiced_ratio = float(voiced_count / max(1, len(f0_contour)))

        # 2. Micro-tremor perturbation (Jitter & Shimmer)
        jitter_local, _ = compute_jitter_local(f0_contour)
        shimmer_local = compute_shimmer_local(raw_audio, f0_contour, sample_rate=sample_rate)

        # 3. Periodicity turbulence (HNR)
        hnr_db = compute_hnr_db(raw_audio, sample_rate=sample_rate)

        # 4. Spectral distribution
        flatness, flux = compute_spectral_features(raw_audio)

        return {
            "mean_f0_hz": round(mean_f0, 1),
            "max_pitch_jump_hz": round(max_jump, 1),
            "jitter_local": round(jitter_local, 5),
            "shimmer_local": round(shimmer_local, 5),
            "hnr_db": round(hnr_db, 2),
            "spectral_flatness": round(flatness, 4),
            "spectral_flux": round(flux, 4),
            "voiced_ratio": round(voiced_ratio, 3),
        }

    def score_features(self, features: Dict[str, Any]) -> float:
        """
        Stage 2: Evaluate physical features against heuristic baseline thresholds.
        Produces S_forensic in [0.0, 100.0].
        """
        if features.get("voiced_ratio", 0.0) < 0.10:
            return 0.0  # Inconclusive/unvoiced signal

        anomaly_points = 0.0

        # Heuristic 1: Sudden unnatural pitch step jump (> 50 Hz)
        if features.get("max_pitch_jump_hz", 0.0) > self.f0_step_threshold_hz:
            anomaly_points += 30.0

        # Heuristic 2: Unnaturally smoothed pitch (< 0.2% jitter on voiced frames)
        jitter = features.get("jitter_local", 0.0)
        if 0.0 < jitter < self.jitter_min:
            anomaly_points += 25.0

        # Heuristic 3: Unnaturally constant amplitude (< 1.5% shimmer)
        shimmer = features.get("shimmer_local", 0.0)
        if 0.0 < shimmer < self.shimmer_min:
            anomaly_points += 20.0

        # Heuristic 4: Degraded harmonics-to-noise ratio (< 15 dB)
        hnr = features.get("hnr_db", 20.0)
        if 0.0 < hnr < self.hnr_min_db:
            anomaly_points += 25.0

        return float(np.clip(anomaly_points, 0.0, 100.0))

    def analyze(self, raw_audio: np.ndarray, sample_rate: int = 16000) -> ForensicResult:
        """Full execution: Extract features then evaluate score."""
        features = self.extract_features(raw_audio, sample_rate)
        if features.get("voiced_ratio", 0.0) < 0.05:
            return ForensicResult(
                score=0.0,
                features=features,
                signal_availability=SignalAvailability.LOW_CONFIDENCE,
            )

        score = self.score_features(features)
        return ForensicResult(
            score=round(score, 2),
            features=features,
            signal_availability=SignalAvailability.AVAILABLE,
        )
