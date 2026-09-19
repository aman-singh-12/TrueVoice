"""
Multi-Signal Mathematical Risk Fusion Engine.
Fuses 5 independent signals with dynamic weight re-normalization:
- S_df: Deepfake artifact probability (0-100)
- S_speaker: Normalized geometric speaker similarity (0-1)
- S_conv: Conversational threat score (0-1)
- S_context: Operational context sensitivity score (0-1)
- S_forensic: Physical acoustic anomaly score (0-100)

Applies non-linear compounding multiplier (Gamma=1.35) for dual critical anomalies.
Explicitly tracks signal availability without silently coercing missing signals to safe or malicious.

NOTE: The output score is a NORMALIZED SECURITY RISK SCORE in [0.0, 100.0].
It is NOT a probability of fraud, NOT a percentage certainty, and NOT proof of fraud.
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from app.config import settings
from app.core.constants import RiskTier, SignalAvailability


def classify_risk_tier(score: float) -> RiskTier:
    """
    Categorize continuous composite risk score into standard TrueVoice risk tier:
    0.0  - 29.9 : LOW (Standard operational monitoring)
    30.0 - 59.9 : MODERATE (Heightened scrutiny / warning)
    60.0 - 79.9 : HIGH (Step-up secondary verification required)
    80.0 - 100.0: CRITICAL (Immediate defensive action / block)
    """
    clamped = float(np.clip(score, 0.0, 100.0))
    if clamped >= 80.0:
        return RiskTier.CRITICAL
    elif clamped >= 60.0:
        return RiskTier.HIGH
    elif clamped >= 30.0:
        return RiskTier.MODERATE
    else:
        return RiskTier.LOW


class MultiSignalRiskFusion:
    """Mathematical multi-signal risk aggregator with dynamic re-normalization and explicit availability."""

    def __init__(
        self,
        weight_df: float = settings.WEIGHT_DEEPFAKE,
        weight_spk: float = settings.WEIGHT_SPEAKER,
        weight_conv: float = settings.WEIGHT_CONVERSATION,
        weight_ctx: float = settings.WEIGHT_CONTEXT,
        weight_for: float = settings.WEIGHT_FORENSIC,
        gamma: float = settings.GAMMA_MULTIPLIER,
    ):
        self.base_weights = {
            "deepfake": weight_df,
            "speaker": weight_spk,
            "conversation": weight_conv,
            "context": weight_ctx,
            "forensics": weight_for,
        }
        self.gamma = gamma

    def fuse(
        self,
        s_df: float,
        df_avail: SignalAvailability,
        s_speaker: Optional[float],
        spk_avail: SignalAvailability,
        s_conv: float,
        conv_avail: SignalAvailability,
        s_context: float,
        ctx_avail: SignalAvailability,
        s_forensic: float,
        for_avail: SignalAvailability,
    ) -> Tuple[float, Dict[str, float], bool]:
        """
        Calculate raw composite security risk score R_raw in [0.0, 100.0].
        Adapts dynamically to whichever subset of signals is available.
        Never treats missing signals as either safe (0.0) or malicious (1.0).

        Returns:
            (r_raw: float, active_weights: Dict[str, float], has_compounding: bool)
        """
        active_signals: Dict[str, float] = {}

        # 1. Deepfake signal (0-100 -> 0-1)
        if df_avail == SignalAvailability.AVAILABLE:
            active_signals["deepfake"] = float(np.clip(s_df / 100.0, 0.0, 1.0))

        # 2. Speaker mismatch signal (1.0 - S_speaker)
        if spk_avail == SignalAvailability.AVAILABLE and s_speaker is not None:
            mismatch = float(np.clip(1.0 - s_speaker, 0.0, 1.0))
            active_signals["speaker"] = mismatch

        # 3. Conversational threat signal (0-1)
        if conv_avail == SignalAvailability.AVAILABLE:
            active_signals["conversation"] = float(np.clip(s_conv, 0.0, 1.0))

        # 4. Context sensitivity signal (0-1)
        if ctx_avail == SignalAvailability.AVAILABLE:
            active_signals["context"] = float(np.clip(s_context, 0.0, 1.0))

        # 5. Forensic acoustic anomaly signal (0-100 -> 0-1)
        if for_avail == SignalAvailability.AVAILABLE:
            active_signals["forensics"] = float(np.clip(s_forensic / 100.0, 0.0, 1.0))

        # If zero signals available, return 0 risk baseline and empty weights
        if not active_signals:
            return 0.0, {}, False

        # Dynamic weight re-normalization across available signals
        active_weight_sum = sum(self.base_weights[k] for k in active_signals.keys())
        if active_weight_sum <= 0:
            active_weight_sum = 1.0

        normalized_weights = {k: self.base_weights[k] / active_weight_sum for k in active_signals.keys()}

        # Weighted linear combination
        linear_sum = sum(normalized_weights[k] * active_signals[k] for k in active_signals.keys())
        r_linear = linear_sum * 100.0

        # Non-linear compounding multiplier (Gamma=1.35) for dual high-risk anomaly
        has_compounding = False
        if df_avail == SignalAvailability.AVAILABLE and s_df >= 70.0:
            spk_elevated = (
                spk_avail == SignalAvailability.AVAILABLE
                and s_speaker is not None
                and s_speaker <= 0.50
            )
            conv_elevated = (conv_avail == SignalAvailability.AVAILABLE and s_conv >= 0.70)
            ctx_elevated = (ctx_avail == SignalAvailability.AVAILABLE and s_context >= 0.70)
            if spk_elevated or conv_elevated or ctx_elevated:
                r_linear = r_linear * self.gamma
                has_compounding = True

        r_raw = float(np.clip(r_linear, 0.0, 100.0))
        return round(r_raw, 2), normalized_weights, has_compounding
