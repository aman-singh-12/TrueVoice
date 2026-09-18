"""
Unit Tests for Zero-Trust State Machine.
Verifies valid state transitions, illegal transition prevention, and analyst review exits.
"""

import pytest

from app.core.constants import TrustState
from app.core.exceptions import InvalidStateTransitionException
from app.policy.state_machine import ZeroTrustStateMachine


def test_initial_state():
    """Verify default initial state is OBSERVING."""
    fsm = ZeroTrustStateMachine()
    assert fsm.current_state == TrustState.OBSERVING


def test_valid_transitions():
    """Verify permissible state transitions."""
    fsm = ZeroTrustStateMachine(initial_state=TrustState.OBSERVING)
    
    # OBSERVING -> CAUTION
    fsm.transition_to(TrustState.CAUTION, "Elevated anomalies")
    assert fsm.current_state == TrustState.CAUTION

    # CAUTION -> VERIFYING
    fsm.transition_to(TrustState.VERIFYING, "Step-up challenge dispatched")
    assert fsm.current_state == TrustState.VERIFYING

    # VERIFYING -> TRUSTED
    fsm.transition_to(TrustState.TRUSTED, "Biometric challenge confirmed")
    assert fsm.current_state == TrustState.TRUSTED


def test_illegal_transition_rejection():
    """Verify illegal transitions raise InvalidStateTransitionException."""
    fsm = ZeroTrustStateMachine(initial_state=TrustState.BLOCKED)
    
    # BLOCKED directly to TRUSTED without analyst review is illegal
    with pytest.raises(InvalidStateTransitionException):
        fsm.transition_to(TrustState.TRUSTED, "Direct bypass attempt")

    # TERMINATED allows no transitions
    fsm_term = ZeroTrustStateMachine(initial_state=TrustState.TERMINATED)
    with pytest.raises(InvalidStateTransitionException):
        fsm_term.transition_to(TrustState.OBSERVING, "Reanimation attempt")


def test_analyst_review_exits():
    """Verify human review exits for analysts."""
    fsm = ZeroTrustStateMachine(initial_state=TrustState.HUMAN_REVIEW)

    # Analyst approves
    fsm.handle_analyst_override("ANALYST_APPROVE", analyst_id="analyst-1", reason="Verified legitimate CEO")
    assert fsm.current_state == TrustState.TRUSTED

    # Restrict
    fsm2 = ZeroTrustStateMachine(initial_state=TrustState.HUMAN_REVIEW)
    fsm2.handle_analyst_override("ANALYST_RESTRICT", analyst_id="analyst-1", reason="Restricted transactions")
    assert fsm2.current_state == TrustState.RESTRICTED

    # Block
    fsm3 = ZeroTrustStateMachine(initial_state=TrustState.HUMAN_REVIEW)
    fsm3.handle_analyst_override("ANALYST_BLOCK", analyst_id="analyst-1", reason="Confirmed attacker")
    assert fsm3.current_state == TrustState.BLOCKED
