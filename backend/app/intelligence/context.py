"""
Operational Context & Metadata Intelligence.
Decouples raw context feature extraction from policy thresholds:
Context Metadata -> Feature Extraction -> Tenant Policy Scoring -> S_context & Active Factors.
Note: Caller ANI is optional communication-gateway-provided context, not a direct cellular intercept.
"""

from typing import Any, Dict, List, Optional
import numpy as np


class ContextResult:
    """Carries extracted context features, active risk factors, and normalized context score."""

    def __init__(self, score: float, risk_factors: List[str], features: Dict[str, Any]):
        self.score = score  # 0.0 to 1.0 (0=standard operational, 1=highly sensitive/suspicious)
        self.risk_factors = risk_factors
        self.features = features


class ContextEngine:
    """Evaluates transactional and communication metadata against configurable tenant parameters."""

    def __init__(
        self,
        high_value_threshold: float = 1000000.0,    # Default ₹10 Lakh demo parameter
        elevated_value_threshold: float = 250000.0, # Default ₹2.5 Lakh demo parameter
        high_value_penalty: float = 0.35,
        elevated_value_penalty: float = 0.15,
        new_beneficiary_penalty: float = 0.30,
        off_hours_penalty: float = 0.15,
        ani_mismatch_penalty: float = 0.20,
    ):
        # Configurable demo/tenant parameters
        self.high_value_threshold = high_value_threshold
        self.elevated_value_threshold = elevated_value_threshold
        self.high_value_penalty = high_value_penalty
        self.elevated_value_penalty = elevated_value_penalty
        self.new_beneficiary_penalty = new_beneficiary_penalty
        self.off_hours_penalty = off_hours_penalty
        self.ani_mismatch_penalty = ani_mismatch_penalty

    def extract_features(
        self, request_context: Dict[str, Any], session_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Stage 1: Extract pure operational features without applying business decisions.
        """
        return {
            "amount": float(request_context.get("amount", 0.0)),
            "is_new_beneficiary": bool(request_context.get("beneficiary_is_new", False)),
            "is_off_hours": bool(session_context.get("is_off_hours", False)),
            "caller_ani_matches": bool(session_context.get("caller_ani_matches_profile", True)),
            "channel_type": str(session_context.get("channel_type", "WEBSOCKET_GATEWAY")),
        }

    def evaluate(
        self, request_context: Dict[str, Any], session_context: Dict[str, Any]
    ) -> ContextResult:
        """
        Stage 2: Evaluate extracted features against tenant-configured penalty weights.
        Produces S_context in [0.0, 1.0].
        """
        features = self.extract_features(request_context, session_context)
        factors: List[str] = []
        score = 0.0

        amount = features["amount"]
        if amount >= self.high_value_threshold:
            score += self.high_value_penalty
            factors.append(f"High-value financial request ({amount:,.2f})")
        elif amount >= self.elevated_value_threshold:
            score += self.elevated_value_penalty
            factors.append(f"Elevated financial request ({amount:,.2f})")

        if features["is_new_beneficiary"]:
            score += self.new_beneficiary_penalty
            factors.append("Transfer requested to unfamiliar/new beneficiary account")

        if features["is_off_hours"]:
            score += self.off_hours_penalty
            factors.append("Call initiated outside normal operational business hours")

        # Note: caller ANI is optional gateway-provided metadata from softphone/PBX
        if not features["caller_ani_matches"]:
            score += self.ani_mismatch_penalty
            factors.append("Gateway caller ANI does not match registered directory")

        s_context = float(np.clip(score, 0.0, 1.0))
        return ContextResult(
            score=round(s_context, 3),
            risk_factors=factors,
            features=features,
        )
