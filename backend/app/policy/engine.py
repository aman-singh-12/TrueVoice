"""
TrueVoice Declarative Policy Engine.
Zero-Trust Policy Decision Point (PDP) evaluating multi-signal telemetry against active tenant policies.
Strictly decoupled from mathematical risk scoring:
Risk Result (score, tier, provenance) -> Policy Engine -> Security Action & Trust State Recommendation.

Enforces Important Security Invariant:
A high deepfake score alone does NOT automatically imply BLOCK.
Decisions synthesize synthetic artifacts, speaker verification, conversational intent,
transaction context, and active trust state.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
import logging

from app.core.constants import RiskTier, TrustState, SecurityActionType, SignalAvailability
from app.config import get_settings

logger = logging.getLogger(__name__)


class PolicyEvaluationResult(BaseModel):
    """Result of policy engine rule evaluation."""
    action: SecurityActionType
    target_trust_state: Optional[TrustState]
    rule_matched: str
    reason: str
    requires_step_up: bool = False
    evidence: List[str] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)


class DeclarativePolicyEngine:
    """
    Zero-Trust Policy Decision Point (PDP).
    Evaluates session risk and contextual factors against configurable tenant rules.
    """

    def __init__(self, tenant_policy: Optional[Dict[str, Any]] = None):
        settings = get_settings()
        policy = tenant_policy or {}

        # Configurable tenant thresholds with authoritative global defaults
        self.caution_threshold: float = float(policy.get("caution_threshold", settings.risk_moderate_threshold))
        self.verify_threshold: float = float(policy.get("verify_threshold", settings.risk_high_threshold))
        self.block_threshold: float = float(policy.get("block_threshold", settings.risk_critical_threshold))
        self.high_value_threshold: float = float(policy.get("high_value_threshold", policy.get("sensitive_amount_threshold", 250000.0)))
        self.enforce_transaction_lock: bool = bool(policy.get("enforce_transaction_lock", True))
        self.policy_name: str = str(policy.get("policy_name", "Default Policy"))
        self.policy_version: str = str(policy.get("version", "1.0.0"))

    def evaluate(
        self,
        composite_risk: float,
        current_state: TrustState,
        signal_scores: Dict[str, float],
        context_features: Optional[Dict[str, Any]] = None,
        signal_availability: Optional[Dict[str, Any]] = None,
        contributing_factors: Optional[List[str]] = None,
    ) -> PolicyEvaluationResult:
        """
        Evaluate security action for current assessment.
        Deterministic priority order:
          1. Critical Security Threat (Composite risk >= block_threshold OR dual high synthetic + verified mismatch/threat) -> BLOCK
          2. High Sensitivity / Escalation Trigger (Executive impersonation / High value with elevated risk) -> HUMAN_REVIEW
          3. High Risk / Step-up Verification Required -> REQUEST_VERIFICATION / RESTRICT
          4. Moderate Risk Anomaly -> WARN / CAUTION
          5. Low Risk Baseline -> ALLOW / TRUSTED
        """
        ctx = context_features or {}
        avail = signal_availability or {}
        evidence = list(contributing_factors or [])

        deepfake_score = signal_scores.get("deepfake_score", 0.0)  # 0.0 - 1.0
        speaker_distance = signal_scores.get("speaker_distance", 0.0)  # 0.0 - 1.0 (1.0 - similarity)
        threat_score = signal_scores.get("threat_score", 0.0)  # 0.0 - 1.0
        forensic_score = signal_scores.get("forensic_score", 0.0)  # 0.0 - 1.0

        is_executive = bool(ctx.get("is_executive_claimed", False) or ctx.get("is_privileged_user", False))
        tx_amount = float(ctx.get("transaction_amount", ctx.get("amount", 0.0)))
        high_value_tx = tx_amount >= self.high_value_threshold

        spk_available = bool(avail.get("speaker", True))
        spk_verified = spk_available and (speaker_distance < 0.25)  # Speaker matches profile

        # -------------------------------------------------------------------------
        # RULE 1: CRITICAL COMPOSITE RISK -> BLOCK
        # Condition A: Multi-signal composite risk reaches critical threshold (>= 80)
        # Condition B: High deepfake (>= 0.75) confirmed with biometric mismatch (> 0.50) or active threat (> 0.60)
        # Note: A high deepfake score ALONE with a verified speaker and low risk does NOT block.
        # -------------------------------------------------------------------------
        dual_anomaly_confirmed = (deepfake_score >= 0.75 and (speaker_distance >= 0.50 or threat_score >= 0.60))
        if composite_risk >= self.block_threshold or dual_anomaly_confirmed:
            rule_name = "RULE_CRITICAL_RISK_BLOCK" if composite_risk >= self.block_threshold else "RULE_DUAL_ANOMALY_CONFIRMED_BLOCK"
            reason = (
                f"Composite security risk ({composite_risk:.1f}) exceeds block threshold ({self.block_threshold:.1f})"
                if composite_risk >= self.block_threshold
                else f"Confirmed voice impersonation attack (synthetic: {deepfake_score:.2f}, threat/mismatch corroborated)"
            )
            return PolicyEvaluationResult(
                action=SecurityActionType.BLOCK,
                target_trust_state=TrustState.BLOCKED,
                rule_matched=rule_name,
                reason=reason,
                requires_step_up=False,
                evidence=evidence,
                details={
                    "composite_risk": composite_risk,
                    "deepfake_score": deepfake_score,
                    "speaker_distance": speaker_distance,
                    "threat_score": threat_score,
                },
            )

        # -------------------------------------------------------------------------
        # RULE 2: EXECUTIVE IMPERSONATION / HIGH-VALUE TRANSACTION -> HUMAN REVIEW
        # -------------------------------------------------------------------------
        if (is_executive and composite_risk >= 50.0) or (high_value_tx and composite_risk >= 55.0):
            reason_str = (
                f"Executive identity claim with elevated security risk ({composite_risk:.1f}) routed for analyst review"
                if is_executive
                else f"High-value operation ({tx_amount:,.2f}) with elevated risk ({composite_risk:.1f}) requires human sign-off"
            )
            return PolicyEvaluationResult(
                action=SecurityActionType.HUMAN_REVIEW,
                target_trust_state=TrustState.HUMAN_REVIEW,
                rule_matched="RULE_HIGH_SENSITIVITY_HUMAN_REVIEW",
                reason=reason_str,
                requires_step_up=False,
                evidence=evidence,
                details={
                    "is_executive": is_executive,
                    "tx_amount": tx_amount,
                    "composite_risk": composite_risk,
                },
            )

        # -------------------------------------------------------------------------
        # RULE 3: HIGH RISK -> STEP-UP SECONDARY VERIFICATION / RESTRICTION
        # Triggered when risk >= verify_threshold (default 60) or threat >= 0.65 or high deepfake without corroboration
        # -------------------------------------------------------------------------
        if composite_risk >= self.verify_threshold or threat_score >= 0.65 or deepfake_score >= 0.70:
            # If high deepfake alone is detected but speaker is verified, request verification rather than blocking
            deepfake_unverified = deepfake_score >= 0.70 and spk_verified

            if current_state in (TrustState.OBSERVING, TrustState.CAUTION, TrustState.TRUSTED):
                reason_detail = (
                    "Synthetic voice artifact detected; step-up verification required to confirm genuine speaker"
                    if deepfake_unverified
                    else f"Elevated security risk ({composite_risk:.1f} >= {self.verify_threshold:.1f}) requires out-of-band verification"
                )
                return PolicyEvaluationResult(
                    action=SecurityActionType.REQUEST_VERIFICATION,
                    target_trust_state=TrustState.VERIFYING,
                    rule_matched="RULE_HIGH_RISK_STEPUP_VERIFICATION",
                    reason=reason_detail,
                    requires_step_up=True,
                    evidence=evidence,
                    details={"composite_risk": composite_risk, "deepfake_score": deepfake_score, "threat_score": threat_score},
                )
            elif current_state == TrustState.VERIFYING:
                return PolicyEvaluationResult(
                    action=SecurityActionType.REQUEST_VERIFICATION,
                    target_trust_state=TrustState.VERIFYING,
                    rule_matched="RULE_VERIFICATION_IN_PROGRESS",
                    reason="Awaiting out-of-band secondary verification challenge resolution",
                    requires_step_up=True,
                    evidence=evidence,
                    details={"composite_risk": composite_risk},
                )
            elif current_state == TrustState.RESTRICTED:
                return PolicyEvaluationResult(
                    action=SecurityActionType.RESTRICT,
                    target_trust_state=TrustState.RESTRICTED,
                    rule_matched="RULE_RESTRICTED_DEFENSIVE_HOLD",
                    reason=f"Risk remains elevated ({composite_risk:.1f}) while in restricted operational state",
                    requires_step_up=False,
                    evidence=evidence,
                    details={"composite_risk": composite_risk},
                )

        # -------------------------------------------------------------------------
        # RULE 4: MODERATE RISK -> CAUTION / WARN
        # Triggered when risk >= caution_threshold (default 30)
        # -------------------------------------------------------------------------
        if composite_risk >= self.caution_threshold or forensic_score >= 0.40:
            target = TrustState.CAUTION if current_state in (TrustState.OBSERVING, TrustState.TRUSTED) else current_state
            return PolicyEvaluationResult(
                action=SecurityActionType.WARN,
                target_trust_state=target,
                rule_matched="RULE_MODERATE_RISK_WARN",
                reason=f"Moderate risk anomaly ({composite_risk:.1f} >= {self.caution_threshold:.1f}) triggers analyst warning and heightened logging",
                requires_step_up=False,
                evidence=evidence,
                details={"composite_risk": composite_risk, "forensic_score": forensic_score},
            )

        # -------------------------------------------------------------------------
        # RULE 5: LOW RISK BASELINE -> ALLOW / TRUSTED
        # -------------------------------------------------------------------------
        target = TrustState.TRUSTED if current_state in (TrustState.OBSERVING, TrustState.CAUTION) else current_state
        return PolicyEvaluationResult(
            action=SecurityActionType.ALLOW,
            target_trust_state=target,
            rule_matched="RULE_LOW_RISK_ALLOW",
            reason=f"Low security risk ({composite_risk:.1f} < {self.caution_threshold:.1f}) satisfies baseline security posture",
            requires_step_up=False,
            evidence=evidence,
            details={"composite_risk": composite_risk},
        )
