"""
Session-Level Risk Intelligence Engine.
Orchestrates multi-signal fusion, asymmetric EMA smoothing, and signal provenance generation.
"""

from typing import Any, Dict, List, Optional
import numpy as np

from app.config import settings
from app.core.constants import RiskTier, SignalAvailability
from app.risk.fusion import MultiSignalRiskFusion, classify_risk_tier
from app.schemas.detection import DeepfakeResult
from app.schemas.speaker import VerificationResult
from app.forensics.analyzer import ForensicResult
from app.intelligence.context import ContextResult


class SessionRiskEngine:
    """Manages rolling temporal risk for a single active voice session."""

    def __init__(
        self,
        session_id: str,
        alpha_attack: float = settings.EMA_ATTACK_ALPHA,
        alpha_decay: float = settings.EMA_DECAY_ALPHA,
    ):
        self.session_id = session_id
        self.alpha_attack = alpha_attack
        self.alpha_decay = alpha_decay
        self.fusion = MultiSignalRiskFusion()
        self.previous_smoothed_score: Optional[float] = None
        self.peak_risk_score: float = 0.0

    def evaluate_chunk(
        self,
        sequence_id: int,
        df_res: DeepfakeResult,
        spk_res: VerificationResult,
        af_res: ForensicResult,
        s_conv: float,
        conv_avail: SignalAvailability,
        ctx_res: ContextResult,
    ) -> Dict[str, Any]:
        """
        Fuse signals, apply asymmetric EMA smoothing, and assemble provenance.
        Returns comprehensive telemetry dictionary.
        """
        # 1. Execute multi-signal fusion
        r_raw, normalized_weights, has_compounding = self.fusion.fuse(
            s_df=df_res.score,
            df_avail=df_res.signal_availability,
            s_speaker=spk_res.similarity if spk_res.signal_availability == SignalAvailability.AVAILABLE else None,
            spk_avail=spk_res.signal_availability,
            s_conv=s_conv,
            conv_avail=conv_avail,
            s_context=ctx_res.score,
            ctx_avail=SignalAvailability.AVAILABLE,
            s_forensic=af_res.score,
            for_avail=af_res.signal_availability,
        )

        # 2. Apply asymmetric exponential moving average (EMA)
        if self.previous_smoothed_score is None:
            r_smoothed = r_raw
        else:
            alpha = self.alpha_attack if r_raw > self.previous_smoothed_score else self.alpha_decay
            r_smoothed = alpha * r_raw + (1.0 - alpha) * self.previous_smoothed_score

        r_smoothed = float(np.clip(r_smoothed, 0.0, 100.0))
        self.previous_smoothed_score = r_smoothed
        self.peak_risk_score = max(self.peak_risk_score, r_smoothed)

        risk_tier = classify_risk_tier(r_smoothed)

        # 3. Identify primary contributing risk factors
        primary_factors: List[str] = []
        if df_res.signal_availability == SignalAvailability.AVAILABLE and df_res.score >= 50.0:
            primary_factors.append(f"Synthetic voice artifacts detected ({df_res.score:.1f}/100)")
        if spk_res.signal_availability == SignalAvailability.AVAILABLE and spk_res.verified is False:
            primary_factors.append(f"Biometric speaker identity mismatch (Similarity: {spk_res.similarity:.2f})")
        if af_res.signal_availability == SignalAvailability.AVAILABLE and af_res.score >= 40.0:
            primary_factors.append(f"Acoustic DSP anomalies ({af_res.score:.1f}/100)")
        if conv_avail == SignalAvailability.AVAILABLE and s_conv >= 0.35:
            primary_factors.append(f"Social-engineering conversational intent ({s_conv:.2f})")
        if ctx_res.risk_factors:
            primary_factors.extend(ctx_res.risk_factors)
        if has_compounding:
            primary_factors.append("Compounding threat multiplier applied (dual critical anomalies)")

        # 4. Construct explicit signal provenance
        provenance = {
            "deepfake": {
                "model_name": df_res.model_name,
                "model_version": df_res.model_version,
                "score": df_res.score,
                "availability": df_res.signal_availability.value,
                "weight_applied": normalized_weights.get("deepfake", 0.0),
                "inference_time_ms": df_res.inference_time_ms,
            },
            "speaker": {
                "model_name": spk_res.model_name,
                "model_version": spk_res.model_version,
                "similarity": spk_res.similarity,
                "verified": spk_res.verified,
                "availability": spk_res.signal_availability.value,
                "weight_applied": normalized_weights.get("speaker", 0.0),
                "inference_time_ms": spk_res.inference_time_ms,
            },
            "forensics": {
                "score": af_res.score,
                "availability": af_res.signal_availability.value,
                "weight_applied": normalized_weights.get("forensics", 0.0),
                "features": af_res.features,
            },
            "conversation": {
                "score": s_conv,
                "availability": conv_avail.value,
                "weight_applied": normalized_weights.get("conversation", 0.0),
            },
            "context": {
                "score": ctx_res.score,
                "availability": SignalAvailability.AVAILABLE.value,
                "weight_applied": normalized_weights.get("context", 0.0),
                "features": ctx_res.features,
            },
        }

        return {
            "session_id": self.session_id,
            "sequence_id": sequence_id,
            "raw_risk": round(r_raw, 2),
            "composite_risk": round(r_smoothed, 2),
            "peak_risk": round(self.peak_risk_score, 2),
            "risk_tier": risk_tier,
            "primary_factors": primary_factors,
            "provenance": provenance,
            "breakdown": {
                "synthetic_score": df_res.score,
                "speaker_similarity": spk_res.similarity if spk_res.similarity is not None else 0.0,
                "conversational_score": s_conv,
                "context_score": ctx_res.score,
                "forensic_score": af_res.score,
            },
        }
