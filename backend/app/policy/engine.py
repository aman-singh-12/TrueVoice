"""
TrueVoice Declarative Policy Engine.
Evaluates composite risk, contextual cues, and tenant-configured rules
to determine enforceable security actions and recommend state transitions.
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel
import logging

from app.core.constants import RiskTier, TrustState, SecurityActionType
from app.config import get_settings

logger = logging.getLogger(__name__)


class PolicyEvaluationResult(BaseModel):
    """Result of policy engine rule evaluation."""
    action: SecurityActionType
    target_trust_state: Optional[TrustState]
    rule_matched: str
    reason: str
    requires_step_up: bool = False
    details: Dict[str, Any] = {}


class DeclarativePolicyEngine:
    """
    Zero-Trust Policy Decision Point (PDP).
    Evaluates session telemetry against active tenant policies and global guardrails.
    """

    def __init__(self, tenant_policy: Optional[Dict[str, Any]] = None):
        self.settings = get_settings()
        self.rules = tenant_policy or {}

    def evaluate(
        self,
        composite_risk: float,
        current_state: TrustState,
        signal_scores: Dict[str, float],
        context_features: Dict[str, Any]
    ) -> PolicyEvaluationResult:
        """
        Evaluate security action for current assessment.
        Deterministic priority order:
          1. Extreme Threat / Critical Deepfake -> BLOCK
          2. Explicit Human Review Trigger -> HUMAN_REVIEW
          3. High Risk / Step-up required -> REQUEST_VERIFICATION / RESTRICT
          4. Moderate Risk -> WARN / CAUTION
          5. Low Risk -> ALLOW / TRUSTED
        """
        deepfake_score = signal_scores.get("deepfake_score", 0.0)
        speaker_distance = signal_scores.get("speaker_distance", 0.0)
        threat_score = signal_scores.get("threat_score", 0.0)
        is_executive = context_features.get("is_executive_claimed", False)
        tx_amount = context_features.get("transaction_amount", 0.0)
        high_value_tx = tx_amount > self.rules.get("high_value_threshold", 50000.0)

        # 1. Critical risk / confirmed deepfake
        if composite_risk >= self.settings.risk_critical_threshold or deepfake_score >= 0.85:
            return PolicyEvaluationResult(
                action=SecurityActionType.BLOCK,
                target_trust_state=TrustState.BLOCKED,
                rule_matched="RULE_CRITICAL_RISK_BLOCK",
                reason=f"Composite risk ({composite_risk:.1f}) exceeds critical threshold or synthetic voice detected ({deepfake_score:.2f})",
                requires_step_up=False,
                details={"composite_risk": composite_risk, "deepfake_score": deepfake_score}
            )

        # 2. Executive impersonation or high-value suspicious transaction -> Human Review
        if (is_executive and composite_risk >= 50.0) or (high_value_tx and composite_risk >= 55.0):
            return PolicyEvaluationResult(
                action=SecurityActionType.HUMAN_REVIEW,
                target_trust_state=TrustState.HUMAN_REVIEW,
                rule_matched="RULE_HIGH_SENSITIVITY_HUMAN_REVIEW",
                reason=f"High sensitivity transaction/executive claim with elevated risk ({composite_risk:.1f}) routed for manual analyst review",
                requires_step_up=False,
                details={"is_executive": is_executive, "tx_amount": tx_amount, "composite_risk": composite_risk}
            )

        # 3. High Risk -> Secondary Verification or Restriction
        if composite_risk >= self.settings.risk_high_threshold or threat_score >= 0.70:
            if current_state in (TrustState.OBSERVING, TrustState.CAUTION, TrustState.TRUSTED):
                return PolicyEvaluationResult(
                    action=SecurityActionType.REQUEST_VERIFICATION,
                    target_trust_state=TrustState.VERIFYING,
                    rule_matched="RULE_HIGH_RISK_STEPUP_VERIFICATION",
                    reason=f"Elevated risk ({composite_risk:.1f}) requires out-of-band secondary identity verification",
                    requires_step_up=True,
                    details={"composite_risk": composite_risk, "threat_score": threat_score}
                )
            elif current_state == TrustState.VERIFYING:
                # Already verifying, wait for challenge resolution
                return PolicyEvaluationResult(
                    action=SecurityActionType.REQUEST_VERIFICATION,
                    target_trust_state=TrustState.VERIFYING,
                    rule_matched="RULE_VERIFICATION_IN_PROGRESS",
                    reason="Awaiting secondary verification challenge resolution",
                    requires_step_up=True,
                    details={"composite_risk": composite_risk}
                )
            else:
                return PolicyEvaluationResult(
                    action=SecurityActionType.RESTRICT,
                    target_trust_state=TrustState.RESTRICTED,
                    rule_matched="RULE_HIGH_RISK_RESTRICTION",
                    reason=f"Elevated risk ({composite_risk:.1f}) in restricted state enforces defensive restriction",
                    requires_step_up=False,
                    details={"composite_risk": composite_risk}
                )

        # 4. Moderate Risk -> Caution / Warning
        if composite_risk >= self.settings.risk_moderate_threshold:
            target = TrustState.CAUTION if current_state in (TrustState.OBSERVING, TrustState.TRUSTED) else current_state
            return PolicyEvaluationResult(
                action=SecurityActionType.WARN,
                target_trust_state=target,
                rule_matched="RULE_MODERATE_RISK_WARN",
                reason=f"Moderate risk ({composite_risk:.1f}) triggers enhanced telemetry and operator warning",
                requires_step_up=False,
                details={"composite_risk": composite_risk}
            )

        # 5. Low Risk -> Allow / Trusted
        target = TrustState.TRUSTED if current_state in (TrustState.OBSERVING, TrustState.CAUTION) else current_state
        return PolicyEvaluationResult(
            action=SecurityActionType.ALLOW,
            target_trust_state=target,
            rule_matched="RULE_LOW_RISK_ALLOW",
            reason=f"Low risk score ({composite_risk:.1f}) satisfies baseline security policy",
            requires_step_up=False,
            details={"composite_risk": composite_risk}
        )
