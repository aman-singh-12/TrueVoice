"""
TrueVoice Policy Management and Enforcement Service.
Evaluates active organizational security policies against real-time session telemetry,
triggers defensive security actions, and logs enforcement to the audit ledger.
"""

from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import logging

from app.models.organization import Policy
from app.models.call_session import CallSession
from app.models.security_action import SecurityAction
from app.schemas.policy import PolicyCreate, PolicyResponse
from app.core.constants import SecurityActionType, ActionTriggerSource, ActionExecutionStatus, AuditEventType, TrustState
from app.core.exceptions import ResourceNotFoundError, TenantAccessViolation
from app.policy.engine import DeclarativePolicyEngine, PolicyEvaluationResult
from app.services.session_service import SessionService
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class PolicyService:
    """Service managing organizational policies and deterministic action enforcement."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.session_service = SessionService(db)
        self.audit_service = AuditService(db)

    async def get_active_policy(self, org_id: UUID) -> Optional[Policy]:
        """Fetch the currently active policy configuration for an organization."""
        stmt = (
            select(Policy)
            .where(Policy.org_id == org_id)
            .order_by(desc(Policy.created_at))
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_or_update_policy(self, org_id: UUID, data: Any) -> Policy:
        """Create a new policy version for the organization."""
        policy = Policy(
            org_id=org_id,
            policy_name=getattr(data, "policy_name", getattr(data, "name", "Default Policy")),
            caution_threshold=getattr(data, "caution_threshold", 30.0),
            verify_threshold=getattr(data, "verify_threshold", 60.0),
            block_threshold=getattr(data, "block_threshold", 80.0),
            enforce_transaction_lock=getattr(data, "enforce_transaction_lock", True),
            sensitive_amount_threshold=getattr(data, "sensitive_amount_threshold", 250000.0),
            oob_timeout_seconds=getattr(data, "oob_timeout_seconds", 30),
            version=getattr(data, "version", "1.0.0"),
        )
        self.db.add(policy)
        await self.db.commit()
        await self.db.refresh(policy)
        logger.info(f"Created active policy {policy.id} ('{policy.policy_name}') for org {org_id}")
        return policy

    async def list_policies(self, org_id: UUID) -> List[Policy]:
        """List all policy versions for organization."""
        stmt = select(Policy).where(Policy.org_id == org_id).order_by(desc(Policy.created_at))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def evaluate_and_enforce(
        self,
        session: CallSession,
        composite_risk: float,
        signal_scores: Dict[str, float],
        context_features: Dict[str, Any],
        signal_availability: Optional[Dict[str, Any]] = None,
        contributing_factors: Optional[List[str]] = None,
    ) -> PolicyEvaluationResult:
        """
        Evaluate real-time risk against active policy and execute action if warranted.
        """
        active_policy = await self.get_active_policy(session.org_id)
        policy_rules = {
            "high_value_threshold": active_policy.sensitive_amount_threshold if active_policy else 250000.0,
            "caution_threshold": active_policy.caution_threshold if active_policy else 30.0,
            "verify_threshold": active_policy.verify_threshold if active_policy else 60.0,
            "block_threshold": active_policy.block_threshold if active_policy else 80.0,
        }

        engine = DeclarativePolicyEngine(tenant_policy=policy_rules)
        current_state = TrustState(session.current_trust_state)
        eval_result = engine.evaluate(
            composite_risk=composite_risk,
            current_state=current_state,
            signal_scores=signal_scores,
            context_features=context_features,
            signal_availability=signal_availability,
            contributing_factors=contributing_factors,
        )

        # Record security action if action is not simply ALLOW
        if eval_result.action != SecurityActionType.ALLOW:
            action = SecurityAction(
                session_id=session.id,
                policy_id=active_policy.id if active_policy else None,
                action_type=eval_result.action.value,
                triggered_by=ActionTriggerSource.POLICY_AUTO.value,
                triggering_reason=eval_result.reason,
                execution_status=ActionExecutionStatus.EXECUTED.value,
            )
            self.db.add(action)

            # Check if target trust state differs and transition
            if eval_result.target_trust_state and eval_result.target_trust_state != current_state:
                try:
                    await self.session_service.transition_state(
                        session=session,
                        target_state=eval_result.target_trust_state,
                        reason=eval_result.reason
                    )
                except Exception as ex:
                    logger.warning(f"Could not transition state for session {session.id}: {ex}")

            # Audit log
            await self.audit_service.log_event(
                session_id=session.id,
                event_type=AuditEventType.POLICY_ACTION_ENFORCED,
                trust_state=TrustState(session.current_trust_state),
                payload={
                    "action_type": eval_result.action.value,
                    "rule_matched": eval_result.rule_matched,
                    "reason": eval_result.reason,
                    "composite_risk": composite_risk,
                }
            )
            await self.db.commit()

        return eval_result
