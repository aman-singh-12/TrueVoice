"""
Acoustic Forensics Analyzer.
Strictly decouples physical feature extraction from decision scoring:
Raw Forensic Audio -> Feature Extraction Layer -> Features Dictionary -> Forensic Scoring Layer -> S_forensic.
Thresholds are configurable heuristic baselines, not universal constants.
Provides deterministic physical measurements and human-readable forensic evidence.
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from app.config import settings
from app.core.constants import SignalAvailability
from app.forensics.f0 import extract_f0_contour
from app.forensics.jitter import compute_jitter_local
from app.forensics.shimmer import compute_shimmer_local
from app.forensics.hnr import compute_hnr_db
from app.forensics.spectral import (
    compute_spectral_features,
    compute_spectral_centroid,
    compute_spectral_rolloff,
)
from app.forensics.energy import (
    compute_rms_energy,
    compute_zcr,
    compute_energy_distribution,
)


class ForensicResult:
    """Carries extracted forensic features, calibrated anomaly score, and evidence."""

    def __init__(
        self,
        score: float,
        features: Dict[str, Any],
        signal_availability: SignalAvailability = SignalAvailability.AVAILABLE,
        evidence: Optional[List[str]] = None,
    ):
        self.score = score  # 0.0 to 100.0 (0=natural acoustic, 100=highly anomalous)
        self.features = features
        self.signal_availability = signal_availability
        self.evidence = evidence if evidence is not None else []

    @property
    def available(self) -> bool:
        return self.signal_availability == SignalAvailability.AVAILABLE


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
                "rms_energy": 0.0,
                "zcr": 0.0,
                "mean_f0_hz": 0.0,
                "max_pitch_jump_hz": 0.0,
                "jitter_local": 0.0,
                "shimmer_local": 0.0,
                "hnr_db": 0.0,
                "spectral_flatness": 0.0,
                "spectral_flux": 0.0,
                "spectral_centroid_hz": 0.0,
                "spectral_rolloff_hz": 0.0,
                "energy_distribution": {"low_ratio": 0.0, "mid_ratio": 0.0, "high_ratio": 0.0},
                "voiced_ratio": 0.0,
            }

        # 1. Energy & Time-domain metrics
        rms = compute_rms_energy(raw_audio)
        zcr = compute_zcr(raw_audio)

        # 2. Pitch & F0 tracking
        f0_contour, mean_f0, max_jump = extract_f0_contour(raw_audio, sample_rate=sample_rate)
        voiced_count = np.count_nonzero(f0_contour > 0.0)
        voiced_ratio = float(voiced_count / max(1, len(f0_contour)))

        # 3. Micro-tremor perturbation (Jitter & Shimmer)
        jitter_local, _ = compute_jitter_local(f0_contour)
        shimmer_local = compute_shimmer_local(raw_audio, f0_contour, sample_rate=sample_rate)

        # 4. Periodicity turbulence (HNR)
        hnr_db = compute_hnr_db(raw_audio, sample_rate=sample_rate)

        # 5. Spectral distribution & dynamics
        flatness, flux = compute_spectral_features(raw_audio)
        centroid = compute_spectral_centroid(raw_audio, sample_rate=sample_rate)
        rolloff = compute_spectral_rolloff(raw_audio, sample_rate=sample_rate)
        energy_dist = compute_energy_distribution(raw_audio, sample_rate=sample_rate)

        return {
            "rms_energy": round(rms, 5),
            "zcr": round(zcr, 5),
            "mean_f0_hz": round(mean_f0, 1),
            "max_pitch_jump_hz": round(max_jump, 1),
            "jitter_local": round(jitter_local, 5),
            "shimmer_local": round(shimmer_local, 5),
            "hnr_db": round(hnr_db, 2),
            "spectral_flatness": round(flatness, 4),
            "spectral_flux": round(flux, 4),
            "spectral_centroid_hz": round(centroid, 1),
            "spectral_rolloff_hz": round(rolloff, 1),
            "energy_distribution": energy_dist,
            "voiced_ratio": round(voiced_ratio, 3),
        }

    def score_features(self, features: Dict[str, Any]) -> Tuple[float, List[str]]:
        """
        Stage 2: Evaluate physical features against heuristic baseline thresholds.
        Produces (S_forensic in [0.0, 100.0], evidence: List[str]).
        """
        if features.get("voiced_ratio", 0.0) < 0.10:
            return 0.0, []  # Inconclusive/unvoiced signal

        anomaly_points = 0.0
        evidence: List[str] = []

        # Heuristic 1: Sudden unnatural pitch step jump (> threshold Hz)
        pitch_jump = features.get("max_pitch_jump_hz", 0.0)
        if pitch_jump > self.f0_step_threshold_hz:
            anomaly_points += 30.0
            evidence.append(f"Unnatural pitch discontinuity step ({pitch_jump:.1f} Hz > {self.f0_step_threshold_hz:.1f} Hz)")

        # Heuristic 2: Unnaturally smoothed pitch (< jitter_min on voiced frames, typical in neural vocoders)
        jitter = features.get("jitter_local", 0.0)
        if 0.0 < jitter < self.jitter_min:
            anomaly_points += 25.0
            evidence.append(f"Acoustic micro-tremor pitch suppression (jitter {jitter:.4f} < {self.jitter_min:.4f})")

        # Heuristic 3: Unnaturally constant amplitude (< shimmer_min)
        shimmer = features.get("shimmer_local", 0.0)
        if 0.0 < shimmer < self.shimmer_min:
            anomaly_points += 20.0
            evidence.append(f"Amplitude perturbation suppression (shimmer {shimmer:.4f} < {self.shimmer_min:.4f})")

        # Heuristic 4: Degraded harmonics-to-noise ratio (< hnr_min_db)
        hnr = features.get("hnr_db", 20.0)
        if 0.0 < hnr < self.hnr_min_db:
            anomaly_points += 25.0
            evidence.append(f"Degraded harmonic periodicity (HNR {hnr:.1f} dB < {self.hnr_min_db:.1f} dB)")

        # Heuristic 5: Anomalous high spectral flatness (overly noisy or white noise artifact)
        flatness = features.get("spectral_flatness", 0.0)
        if flatness > 0.40:
            anomaly_points += 15.0
            evidence.append(f"Elevated spectral flatness ({flatness:.4f}), indicating synthetic noise floor")

        final_score = float(np.clip(anomaly_points, 0.0, 100.0))
        return final_score, evidence

    def analyze(self, raw_audio: np.ndarray, sample_rate: int = 16000) -> ForensicResult:
        """Full execution: Extract features then evaluate score and evidence."""
        features = self.extract_features(raw_audio, sample_rate)
        if features.get("voiced_ratio", 0.0) < 0.05:
            return ForensicResult(
                score=0.0,
                features=features,
                signal_availability=SignalAvailability.LOW_CONFIDENCE,
                evidence=["Low voiced speech content in analysis window"],
            )

        score, evidence = self.score_features(features)
        return ForensicResult(
            score=round(score, 2),
            features=features,
            signal_availability=SignalAvailability.AVAILABLE,
            evidence=evidence,
        )
