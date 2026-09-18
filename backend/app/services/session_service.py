"""
TrueVoice Session Service.
Orchestrates lifecycle, state transitions, tenant isolation, and audit logging for voice sessions.
"""

import secrets
from typing import List, Optional, Tuple
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import logging

from app.models.call_session import CallSession
from app.models.speaker_profile import SpeakerProfile
from app.schemas.session import SessionCreate
from app.core.constants import TrustState, AuditEventType
from app.core.exceptions import ResourceNotFoundError, TenantAccessViolation
from app.policy.state_machine import ZeroTrustStateMachine
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class SessionService:
    """Business logic for call session management under strict tenant isolation."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit_service = AuditService(db)

    async def create_session(self, org_id: UUID, data: SessionCreate) -> CallSession:
        """Initialize a new voice interaction session."""
        session_token = f"tvs_{secrets.token_hex(24)}"
        
        # Verify speaker profile belongs to org if specified
        claimed_id = None
        if data.claimed_speaker_id:
            speaker = await self.db.get(SpeakerProfile, data.claimed_speaker_id)
            if not speaker or speaker.org_id != org_id:
                raise ResourceNotFoundError("SpeakerProfile", str(data.claimed_speaker_id))
            claimed_id = speaker.id

        session = CallSession(
            org_id=org_id,
            session_token=session_token,
            claimed_speaker_id=claimed_id,
            caller_ani=data.caller_ani or "UNKNOWN",
            context_metadata=data.context_metadata or {},
            current_trust_state=TrustState.OBSERVING.value,
            peak_risk_score=0.0,
        )
        self.db.add(session)
        await self.db.flush()

        # Append genesis audit event
        await self.audit_service.log_event(
            session_id=session.id,
            event_type=AuditEventType.SESSION_CREATED,
            trust_state=TrustState.OBSERVING,
            payload={
                "session_token": session_token,
                "claimed_speaker_id": str(claimed_id) if claimed_id else None,
                "caller_ani": session.caller_ani,
                "org_id": str(org_id),
            }
        )
        await self.db.commit()
        await self.db.refresh(session)
        logger.info(f"Created session {session.id} for org {org_id}")
        return session

    async def get_session(self, session_id: UUID, org_id: Optional[UUID] = None) -> CallSession:
        """Fetch session with mandatory tenant check if org_id is provided."""
        stmt = select(CallSession).where(CallSession.id == session_id)
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            raise ResourceNotFoundError("CallSession", str(session_id))
        if org_id and str(session.org_id) != str(org_id):
            raise TenantAccessViolation("Cannot access session from another organization")
        return session


    async def get_session_by_token(self, token: str) -> CallSession:
        """Fetch session by authentication session token."""
        stmt = select(CallSession).where(CallSession.session_token == token)
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()
        if not session:
            raise ResourceNotFoundError("CallSession", token)
        return session

    async def list_sessions(
        self,
        org_id: UUID,
        skip: int = 0,
        limit: int = 50
    ) -> List[CallSession]:
        """List sessions for a specific tenant organization."""
        stmt = (
            select(CallSession)
            .where(CallSession.org_id == org_id)
            .order_by(desc(CallSession.started_at))
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def transition_state(
        self,
        session: CallSession,
        target_state: TrustState,
        reason: str,
        actor_id: Optional[str] = None
    ) -> Tuple[TrustState, TrustState]:
        """
        Execute validated state transition on session using ZeroTrustStateMachine.
        Persists state and logs to audit ledger.
        """
        current_enum = TrustState(session.current_trust_state)
        fsm = ZeroTrustStateMachine(initial_state=current_enum)
        from_state, to_state = fsm.transition_to(target_state, reason, actor_id=actor_id)

        session.current_trust_state = to_state.value
        await self.audit_service.log_event(
            session_id=session.id,
            event_type=AuditEventType.STATE_TRANSITION,
            trust_state=to_state,
            payload={
                "from_state": from_state.value,
                "to_state": to_state.value,
                "reason": reason,
                "actor_id": actor_id,
            }
        )
        await self.db.commit()
        await self.db.refresh(session)
        return from_state, to_state

    async def terminate_session(
        self,
        session_id: UUID,
        org_id: UUID,
        actor_id: Optional[str] = None
    ) -> CallSession:
        """Finalize session and set state to TERMINATED."""
        session = await self.get_session(session_id, org_id)
        if session.ended_at:
            return session

        current_enum = TrustState(session.current_trust_state)
        fsm = ZeroTrustStateMachine(initial_state=current_enum)
        fsm.transition_to(TrustState.TERMINATED, "Session finalized", actor_id=actor_id)

        session.current_trust_state = TrustState.TERMINATED.value
        session.ended_at = datetime.now(timezone.utc)

        await self.audit_service.log_event(
            session_id=session.id,
            event_type=AuditEventType.SESSION_TERMINATED,
            trust_state=TrustState.TERMINATED,
            payload={"ended_at": session.ended_at.isoformat(), "actor_id": actor_id}
        )
        await self.db.commit()
        await self.db.refresh(session)
        return session
