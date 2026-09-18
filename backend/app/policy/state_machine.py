"""
TrueVoice Zero-Trust State Machine.
Manages session trust lifecycle across 7 primary states plus TERMINATED.
Enforces explicit valid transitions, analyst review exits, and zero-trust invariants.
"""

from typing import Dict, Set, Optional, Tuple
from datetime import datetime, timezone
import logging

from app.core.constants import TrustState
from app.core.exceptions import InvalidStateTransitionException

logger = logging.getLogger(__name__)


# Valid transition map defining permissible forward/backward steps in zero-trust lifecycle
VALID_TRANSITIONS: Dict[TrustState, Set[TrustState]] = {
    TrustState.OBSERVING: {
        TrustState.CAUTION,
        TrustState.VERIFYING,
        TrustState.TRUSTED,
        TrustState.RESTRICTED,
        TrustState.BLOCKED,
        TrustState.HUMAN_REVIEW,
        TrustState.TERMINATED,
    },
    TrustState.CAUTION: {
        TrustState.OBSERVING,
        TrustState.VERIFYING,
        TrustState.TRUSTED,
        TrustState.RESTRICTED,
        TrustState.BLOCKED,
        TrustState.HUMAN_REVIEW,
        TrustState.TERMINATED,
    },
    TrustState.VERIFYING: {
        TrustState.TRUSTED,         # Verification succeeded
        TrustState.CAUTION,         # Verification inconclusive / reset
        TrustState.RESTRICTED,      # Verification failed / timed out
        TrustState.BLOCKED,         # Critical deepfake detected during ceremony
        TrustState.HUMAN_REVIEW,    # Flagged for analyst investigation
        TrustState.TERMINATED,
    },
    TrustState.TRUSTED: {
        TrustState.CAUTION,         # Subtle drift or suspicious prompt
        TrustState.VERIFYING,       # High-value action requiring step-up
        TrustState.RESTRICTED,      # Sudden risk surge
        TrustState.BLOCKED,         # Instant attack detection
        TrustState.HUMAN_REVIEW,
        TrustState.TERMINATED,
    },
    TrustState.RESTRICTED: {
        TrustState.VERIFYING,       # User attempts step-up verification to clear restriction
        TrustState.BLOCKED,         # Escalated to full block
        TrustState.HUMAN_REVIEW,    # Analyst escalates or investigates
        TrustState.TERMINATED,
    },
    TrustState.BLOCKED: {
        TrustState.HUMAN_REVIEW,    # Only human analyst review can inspect/override a block
        TrustState.TERMINATED,
    },
    TrustState.HUMAN_REVIEW: {
        TrustState.TRUSTED,         # Analyst approved
        TrustState.RESTRICTED,      # Analyst chose restricted mode
        TrustState.BLOCKED,         # Analyst confirmed malicious
        TrustState.TERMINATED,
    },
    TrustState.TERMINATED: set(),  # Terminal state: no outbound transitions permitted
}


class ZeroTrustStateMachine:
    """
    State machine tracking the zero-trust lifecycle of an active voice session.
    Guarantees strict separation between raw numeric risk scores and operational trust state.
    """

    def __init__(self, initial_state: TrustState = TrustState.OBSERVING):
        self._current_state = initial_state
        self._history = [(initial_state, "Session initialized", datetime.now(timezone.utc))]

    @property
    def current_state(self) -> TrustState:
        return self._current_state

    @property
    def history(self):
        return list(self._history)

    def can_transition_to(self, target_state: TrustState) -> bool:
        """Check if transition from current state to target state is legally allowed."""
        allowed = VALID_TRANSITIONS.get(self._current_state, set())
        return target_state in allowed

    def transition_to(
        self,
        target_state: TrustState,
        reason: str,
        actor_id: Optional[str] = None
    ) -> Tuple[TrustState, TrustState]:
        """
        Attempt a state transition.
        Raises InvalidStateTransitionException if transition is disallowed.
        Returns (from_state, to_state).
        """
        if target_state == self._current_state:
            return self._current_state, self._current_state

        if not self.can_transition_to(target_state):
            err_msg = (
                f"Transition from {self._current_state.value} to {target_state.value} "
                f"is not permitted by Zero-Trust State Machine rules."
            )
            logger.warning(err_msg, extra={"current_state": self._current_state.value, "target_state": target_state.value})
            raise InvalidStateTransitionException(
                current_state=self._current_state.value,
                attempted_state=target_state.value,
                reason=err_msg
            )

        from_state = self._current_state
        self._current_state = target_state
        timestamp = datetime.now(timezone.utc)
        self._history.append((target_state, reason, timestamp))

        logger.info(
            f"Zero-Trust State transitioned: {from_state.value} -> {target_state.value} (reason: {reason})",
            extra={
                "from_state": from_state.value,
                "to_state": target_state.value,
                "reason": reason,
                "actor_id": actor_id
            }
        )
        return from_state, target_state

    def handle_analyst_override(
        self,
        action: str,
        analyst_id: str,
        reason: str
    ) -> Tuple[TrustState, TrustState]:
        """
        Enforce analyst exit actions from HUMAN_REVIEW or override states.
        Supported actions:
          - ANALYST_APPROVE -> TRUSTED
          - ANALYST_RESTRICT -> RESTRICTED
          - ANALYST_BLOCK -> BLOCKED
        """
        action_map = {
            "ANALYST_APPROVE": TrustState.TRUSTED,
            "ANALYST_RESTRICT": TrustState.RESTRICTED,
            "ANALYST_BLOCK": TrustState.BLOCKED,
        }
        target = action_map.get(action.upper())
        if not target:
            raise InvalidStateTransitionException(
                current_state=self._current_state.value,
                attempted_state=action,
                reason=f"Unknown analyst override action: {action}. Must be one of {list(action_map.keys())}"
            )

        if self._current_state != TrustState.HUMAN_REVIEW:
            if not self.can_transition_to(target):
                if self.can_transition_to(TrustState.HUMAN_REVIEW):
                    self.transition_to(TrustState.HUMAN_REVIEW, f"Analyst {analyst_id} initiating review override", actor_id=analyst_id)
                else:
                    raise InvalidStateTransitionException(
                        current_state=self._current_state.value,
                        attempted_state=target.value,
                        reason=f"Analyst override not permitted from current state {self._current_state.value}"
                    )

        return self.transition_to(target, f"Analyst override [{action}] by {analyst_id}: {reason}", actor_id=analyst_id)
