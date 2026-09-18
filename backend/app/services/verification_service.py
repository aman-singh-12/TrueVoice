"""
TrueVoice Verification Service.
Coordinates challenge dispatch, nonce tracking, cryptographic response validation,
and Zero-Trust State Machine transitions.
"""

from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import logging

from app.models.verification_event import VerificationEvent
from app.models.call_session import CallSession
from app.core.constants import ChallengeType, ChallengeStatus, TrustState, AuditEventType
from app.core.exceptions import ResourceNotFoundError, VerificationError
from app.verification.oob import OutOfBandVerificationManager
from app.services.session_service import SessionService
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class VerificationService:
    """Service orchestrating secondary identity challenges and response resolution."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.oob_manager = OutOfBandVerificationManager()
        self.session_service = SessionService(db)
        self.audit_service = AuditService(db)

    async def dispatch_challenge(
        self,
        session_id: UUID,
        org_id: UUID,
        challenge_type: ChallengeType = ChallengeType.OOB_PUSH,
        ttl_seconds: int = 30
    ) -> VerificationEvent:
        """
        Issue a new secondary verification challenge for a voice session.
        Transitions session to VERIFYING state and records challenge event.
        """
        session = await self.session_service.get_session(session_id, org_id)

        challenge_data = self.oob_manager.generate_challenge(
            session_id=str(session_id),
            challenge_type=challenge_type,
            ttl_seconds=ttl_seconds
        )

        event = VerificationEvent(
            session_id=session_id,
            challenge_type=challenge_data["challenge_type"],
            challenge_token=challenge_data["challenge_token"],
            nonce=challenge_data["nonce"],
            status=challenge_data["status"],
            attempt_count=0,
            expires_at=challenge_data["expires_at"],
            dispatched_at=challenge_data["dispatched_at"],
        )
        self.db.add(event)
        await self.db.flush()

        # Update session state to VERIFYING
        if session.current_trust_state != TrustState.VERIFYING.value:
            await self.session_service.transition_state(
                session=session,
                target_state=TrustState.VERIFYING,
                reason=f"Secondary verification challenge dispatched ({challenge_type.value})"
            )

        # Audit log
        await self.audit_service.log_event(
            session_id=session_id,
            event_type=AuditEventType.VERIFICATION_DISPATCHED,
            trust_state=TrustState.VERIFYING,
            payload={
                "challenge_token": event.challenge_token,
                "challenge_type": event.challenge_type,
                "expires_at": event.expires_at.isoformat(),
            }
        )
        await self.db.commit()
        await self.db.refresh(event)
        logger.info(f"Dispatched {challenge_type.value} challenge {event.id} for session {session_id}")
        return event

    async def submit_response(
        self,
        session_id: UUID,
        challenge_token: str,
        client_response: str,
        org_id: UUID
    ) -> Dict[str, Any]:
        """
        Validate proof for an active verification challenge.
        On success, transitions session to TRUSTED; on failure/timeout, transitions to RESTRICTED.
        """
        session = await self.session_service.get_session(session_id, org_id)

        stmt = select(VerificationEvent).where(
            VerificationEvent.session_id == session_id,
            VerificationEvent.challenge_token == challenge_token
        )
        result = await self.db.execute(stmt)
        event = result.scalar_one_or_none()

        if not event:
            raise ResourceNotFoundError("VerificationEvent", challenge_token)

        is_valid, new_status, reason = self.oob_manager.verify_response(
            challenge_token=event.challenge_token,
            nonce=event.nonce,
            client_response=client_response,
            current_status=event.status,
            expires_at=event.expires_at,
            attempt_count=event.attempt_count,
        )

        event.attempt_count += 1
        event.status = new_status.value

        target_state = TrustState(session.current_trust_state)
        if new_status == ChallengeStatus.SUCCESS:
            event.resolved_at = datetime.now(timezone.utc)
            target_state = TrustState.TRUSTED
            await self.session_service.transition_state(
                session=session,
                target_state=target_state,
                reason="Secondary verification succeeded"
            )
        elif new_status in (ChallengeStatus.REJECTED, ChallengeStatus.TIMEOUT):
            event.resolved_at = datetime.now(timezone.utc)
            target_state = TrustState.RESTRICTED
            await self.session_service.transition_state(
                session=session,
                target_state=target_state,
                reason=f"Secondary verification failed ({new_status.value}): {reason}"
            )

        # Audit log resolution
        await self.audit_service.log_event(
            session_id=session_id,
            event_type=AuditEventType.VERIFICATION_RESOLVED,
            trust_state=target_state,
            payload={
                "challenge_token": challenge_token,
                "status": new_status.value,
                "is_valid": is_valid,
                "reason": reason,
                "attempt_count": event.attempt_count,
            }
        )
        await self.db.commit()
        await self.db.refresh(event)

        return {
            "is_valid": is_valid,
            "status": new_status.value,
            "reason": reason,
            "current_trust_state": session.current_trust_state,
        }
