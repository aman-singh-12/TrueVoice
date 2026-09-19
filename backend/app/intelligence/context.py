"""
Operational Context & Metadata Intelligence Engine.
Evaluates transactional, identity, and environmental context independently from acoustic authenticity:
Context Metadata -> Feature Extraction -> Tenant Policy Scoring -> S_context & Structured Factors.

Signals Evaluated:
- Transaction Amount (configurable high-value & elevated thresholds)
- New Beneficiary (unfamiliar / newly enrolled beneficiary account)
- Unusual Channel (unrecognized gateway or non-standard client transport)
- Off-Hours Operation (call initiated outside tenant operational business hours)
- Caller Directory Mismatch (gateway-provided ANI diverges from customer profile)
- Privileged User (account holds administrative or executive privileges)
- Sensitive Operation (credential reset, limit increase, security profile modification)
- Unusual Transaction (out-of-band velocity or transaction anomaly)

Context MUST remain separate from voice authenticity: an elevated context score reflects
transaction sensitivity/exposure, NOT proof of synthetic voice.
"""

from typing import Any, Dict, List, Optional
import numpy as np


class ContextResult:
    """Carries extracted context features, active risk factors, structured factor list, and normalized score."""

    def __init__(
        self,
        score: float,
        risk_factors: List[str],
        features: Dict[str, Any],
        factors: Optional[List[Dict[str, Any]]] = None,
        available: bool = True,
    ):
        self.score = score  # 0.0 to 1.0 (0=standard operational, 1=highly sensitive/critical exposure)
        self.risk_factors = risk_factors  # Human-readable factor descriptions
        self.features = features  # Raw extracted feature dictionary
        self.factors = factors if factors is not None else []  # Structured factor items: [{"type": ..., "value": ...}]
        self.available = available


class ContextEngine:
    """Evaluates transactional and environmental metadata against configurable tenant parameters."""

    def __init__(
        self,
        tenant_policy: Optional[Dict[str, Any]] = None,
        high_value_threshold: float = 1000000.0,       # Default ₹10 Lakh baseline
        elevated_value_threshold: float = 250000.0,    # Default ₹2.5 Lakh baseline
        high_value_penalty: float = 0.35,
        elevated_value_penalty: float = 0.15,
        new_beneficiary_penalty: float = 0.30,
        off_hours_penalty: float = 0.15,
        ani_mismatch_penalty: float = 0.20,
        unusual_channel_penalty: float = 0.20,
        privileged_user_penalty: float = 0.25,
        sensitive_operation_penalty: float = 0.30,
        unusual_transaction_penalty: float = 0.20,
    ):
        policy = tenant_policy or {}
        # Configurable tenant policy parameters
        self.high_value_threshold = float(policy.get("high_value_threshold", high_value_threshold))
        self.elevated_value_threshold = float(policy.get("elevated_value_threshold", elevated_value_threshold))
        self.high_value_penalty = float(policy.get("high_value_penalty", high_value_penalty))
        self.elevated_value_penalty = float(policy.get("elevated_value_penalty", elevated_value_penalty))
        self.new_beneficiary_penalty = float(policy.get("new_beneficiary_penalty", new_beneficiary_penalty))
        self.off_hours_penalty = float(policy.get("off_hours_penalty", off_hours_penalty))
        self.ani_mismatch_penalty = float(policy.get("ani_mismatch_penalty", ani_mismatch_penalty))
        self.unusual_channel_penalty = float(policy.get("unusual_channel_penalty", unusual_channel_penalty))
        self.privileged_user_penalty = float(policy.get("privileged_user_penalty", privileged_user_penalty))
        self.sensitive_operation_penalty = float(policy.get("sensitive_operation_penalty", sensitive_operation_penalty))
        self.unusual_transaction_penalty = float(policy.get("unusual_transaction_penalty", unusual_transaction_penalty))

    def extract_features(
        self,
        request_context: Optional[Dict[str, Any]] = None,
        session_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Stage 1: Extract pure operational features without applying business decisions.
        Safely merges request metadata and session metadata.
        """
        req = request_context or {}
        sess = session_context or {}

        # Channel evaluation
        channel_type = str(sess.get("channel_type", req.get("channel_type", "WEBSOCKET_GATEWAY")))
        known_standard_channels = {"WEBSOCKET_GATEWAY", "INTERNAL_SIP_TRUNK", "PSTN_INBOUND", "SECURE_CONSOLE"}
        is_unusual_channel = bool(
            sess.get("is_unusual_channel", req.get("is_unusual_channel", channel_type not in known_standard_channels))
        )

        # Sensitive operation indicators
        operation_type = str(req.get("operation_type", sess.get("operation_type", "STANDARD_INTERACTION"))).upper()
        sensitive_operations = {
            "PASSWORD_RESET", "LIMIT_INCREASE", "MFA_OVERRIDE", "BENEFICIARY_ADDITION",
            "ACCOUNT_RECOVERY", "DEVICE_PAIRING", "WIRE_TRANSFER"
        }
        is_sensitive_op = bool(
            req.get("is_sensitive_operation", operation_type in sensitive_operations)
        )

        return {
            "amount": float(req.get("amount", req.get("transaction_amount", 0.0))),
            "is_new_beneficiary": bool(req.get("beneficiary_is_new", req.get("is_new_beneficiary", False))),
            "is_off_hours": bool(sess.get("is_off_hours", req.get("is_off_hours", False))),
            "caller_ani_matches": bool(sess.get("caller_ani_matches_profile", req.get("caller_ani_matches", True))),
            "channel_type": channel_type,
            "is_unusual_channel": is_unusual_channel,
            "is_privileged_user": bool(req.get("is_privileged_user", sess.get("is_privileged_user", False))),
            "is_sensitive_operation": is_sensitive_op,
            "is_unusual_transaction": bool(req.get("is_unusual_transaction", False)),
        }

    def evaluate(
        self,
        request_context: Optional[Dict[str, Any]] = None,
        session_context: Optional[Dict[str, Any]] = None,
    ) -> ContextResult:
        """
        Stage 2: Evaluate extracted features against configured tenant weights.
        Produces S_context in [0.0, 1.0] and structured factor provenance.
        """
        # If neither request nor session context has meaningful data, mark unavailable or zero baseline
        if not request_context and not session_context:
            return ContextResult(
                score=0.0,
                risk_factors=[],
                features={},
                factors=[],
                available=False,
            )

        features = self.extract_features(request_context, session_context)
        risk_factor_strings: List[str] = []
        structured_factors: List[Dict[str, Any]] = []
        score = 0.0

        # 1. Transaction Amount Sensitivity
        amount = features["amount"]
        if amount >= self.high_value_threshold:
            score += self.high_value_penalty
            risk_factor_strings.append(f"High-value financial operation ({amount:,.2f} >= {self.high_value_threshold:,.2f})")
            structured_factors.append({
                "type": "HIGH_VALUE_OPERATION",
                "value": self.high_value_penalty,
                "amount": amount,
                "threshold": self.high_value_threshold,
            })
        elif amount >= self.elevated_value_threshold:
            score += self.elevated_value_penalty
            risk_factor_strings.append(f"Elevated financial operation ({amount:,.2f} >= {self.elevated_value_threshold:,.2f})")
            structured_factors.append({
                "type": "ELEVATED_VALUE_OPERATION",
                "value": self.elevated_value_penalty,
                "amount": amount,
                "threshold": self.elevated_value_threshold,
            })

        # 2. New / Unfamiliar Beneficiary
        if features["is_new_beneficiary"]:
            score += self.new_beneficiary_penalty
            risk_factor_strings.append("Transaction requested to new or unverified beneficiary account")
            structured_factors.append({
                "type": "NEW_BENEFICIARY",
                "value": self.new_beneficiary_penalty,
            })

        # 3. Off-Hours Interaction
        if features["is_off_hours"]:
            score += self.off_hours_penalty
            risk_factor_strings.append("Interaction initiated outside standard operational business hours")
            structured_factors.append({
                "type": "OFF_HOURS",
                "value": self.off_hours_penalty,
            })

        # 4. Caller Directory / Gateway Mismatch
        if not features["caller_ani_matches"]:
            score += self.ani_mismatch_penalty
            risk_factor_strings.append("Gateway caller ANI does not match registered customer directory")
            structured_factors.append({
                "type": "CALLER_DIRECTORY_MISMATCH",
                "value": self.ani_mismatch_penalty,
            })

        # 5. Unusual Communication Channel
        if features["is_unusual_channel"]:
            score += self.unusual_channel_penalty
            risk_factor_strings.append(f"Interaction received via non-standard communication channel ({features['channel_type']})")
            structured_factors.append({
                "type": "UNUSUAL_CHANNEL",
                "value": self.unusual_channel_penalty,
                "channel": features["channel_type"],
            })

        # 6. Privileged Account Target
        if features["is_privileged_user"]:
            score += self.privileged_user_penalty
            risk_factor_strings.append("Target account holds elevated administrative or executive privileges")
            structured_factors.append({
                "type": "PRIVILEGED_USER",
                "value": self.privileged_user_penalty,
            })

        # 7. Sensitive Operational Action
        if features["is_sensitive_operation"]:
            score += self.sensitive_operation_penalty
            risk_factor_strings.append("Sensitive security configuration or credential management operation requested")
            structured_factors.append({
                "type": "SENSITIVE_OPERATION",
                "value": self.sensitive_operation_penalty,
            })

        # 8. Unusual Transaction Velocity / Pattern
        if features["is_unusual_transaction"]:
            score += self.unusual_transaction_penalty
            risk_factor_strings.append("Transaction deviates significantly from customer historical baseline")
            structured_factors.append({
                "type": "UNUSUAL_TRANSACTION",
                "value": self.unusual_transaction_penalty,
            })

        s_context = float(np.clip(score, 0.0, 1.0))
        return ContextResult(
            score=round(s_context, 3),
            risk_factors=risk_factor_strings,
            features=features,
            factors=structured_factors,
            available=True,
        )
