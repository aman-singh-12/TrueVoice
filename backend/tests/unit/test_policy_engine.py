"""
Unit Tests for Declarative Policy Engine (Part E).
Verifies rule decoupling, mitigation-aware BLOCK evaluation, step-up verification,
and executive escalation handling.
"""

import pytest
from app.core.constants import SecurityActionType, TrustState
from app.policy.engine import DeclarativePolicyEngine, PolicyEvaluationResult


def test_deepfake_alone_with_verified_speaker_does_not_instant_block():
    """
    CRITICAL SECURITY INVARIANT:
    A high deepfake score alone does NOT automatically force BLOCK if mitigating factors
    (e.g., highly verified speaker identity, low context threat) exist.
    Instead, it dispatches step-up verification (REQUEST_VERIFICATION) or RESTRICT.
    """
    engine = DeclarativePolicyEngine()

    signal_scores = {
        "deepfake_score": 0.88,       # High acoustic deepfake suspicion
        "speaker_distance": 0.05,     # Speaker is verified (similarity 0.95 -> distance 0.05)
        "threat_score": 0.0,          # No conversational threat
        "forensic_score": 0.10,       # Normal physical harmonics
    }
    context_features = {
        "amount": 1000.0,
        "is_privileged_user": False,
    }

    res = engine.evaluate(
        composite_risk=72.0,
        current_state=TrustState.OBSERVING,
        signal_scores=signal_scores,
        context_features=context_features,
    )

    # Must NOT be BLOCK because speaker is verified (distance < 0.20 mitigates synthetic false-positive)
    assert res.action != SecurityActionType.BLOCK
    # Should require secondary verification
    assert res.action == SecurityActionType.REQUEST_VERIFICATION


def test_dual_anomaly_triggers_instant_block():
    """
    When dual independent anomalies are confirmed (e.g. Deepfake + Speaker Mismatch, or Deepfake + Threat),
    policy engine enforces BLOCK.
    """
    engine = DeclarativePolicyEngine()

    signal_scores = {
        "deepfake_score": 0.88,       # High deepfake
        "speaker_distance": 0.75,     # High mismatch
        "threat_score": 0.60,         # Credential solicitation
        "forensic_score": 0.70,
    }
    context_features = {
        "amount": 500000.0,
    }

    res = engine.evaluate(
        composite_risk=85.0,
        current_state=TrustState.OBSERVING,
        signal_scores=signal_scores,
        context_features=context_features,
    )

    assert res.action == SecurityActionType.BLOCK
    assert res.target_trust_state == TrustState.BLOCKED
    assert "dual" in res.reason.lower() or "critical" in res.reason.lower() or "block" in res.reason.lower()


def test_executive_escalation_triggers_human_review_or_restrict():
    """
    Elevated risk involving a privileged user (e.g. CEO/CFO) triggers human escalation.
    """
    engine = DeclarativePolicyEngine()

    signal_scores = {
        "deepfake_score": 0.65,
        "speaker_distance": 0.40,
        "threat_score": 0.30,
        "forensic_score": 0.30,
    }
    context_features = {
        "is_privileged_user": True,
        "amount": 100000.0,
    }

    res = engine.evaluate(
        composite_risk=65.0,
        current_state=TrustState.OBSERVING,
        signal_scores=signal_scores,
        context_features=context_features,
    )

    # Privileged account with moderate/high risk should escalate to HUMAN_REVIEW or RESTRICT
    assert res.target_trust_state in (TrustState.HUMAN_REVIEW, TrustState.RESTRICTED, TrustState.VERIFYING)


def test_caution_and_allow_tiers():
    """Verify LOW risk produces ALLOW and MODERATE risk produces WARN."""
    engine = DeclarativePolicyEngine()

    # Low risk
    res_allow = engine.evaluate(
        composite_risk=15.0,
        current_state=TrustState.OBSERVING,
        signal_scores={"deepfake_score": 0.1, "speaker_distance": 0.1, "threat_score": 0.0, "forensic_score": 0.1},
        context_features={},
    )
    assert res_allow.action == SecurityActionType.ALLOW
    assert res_allow.target_trust_state == TrustState.TRUSTED

    # Moderate risk (caution)
    res_warn = engine.evaluate(
        composite_risk=45.0,
        current_state=TrustState.OBSERVING,
        signal_scores={"deepfake_score": 0.4, "speaker_distance": 0.3, "threat_score": 0.1, "forensic_score": 0.2},
        context_features={},
    )
    assert res_warn.action == SecurityActionType.WARN
    assert res_warn.target_trust_state == TrustState.CAUTION
