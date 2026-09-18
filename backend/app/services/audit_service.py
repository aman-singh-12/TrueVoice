"""
TrueVoice Audit Service.
Appends cryptographically chained records to the tamper-evident audit ledger
and verifies chain integrity for compliance and forensic analysis.
"""

from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import logging

from app.models.audit_log import AuditLog
from app.audit.chain import AuditLedgerChainer, GENESIS_PREV_HASH
from app.core.constants import AuditEventType, TrustState
from app.core.exceptions import ResourceNotFoundError, AuditTamperDetectedError

logger = logging.getLogger(__name__)


class AuditService:
    """Service for appending and verifying tamper-evident audit ledger records."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_event(
        self,
        session_id: UUID,
        event_type: AuditEventType,
        trust_state: TrustState,
        payload: Dict[str, Any]
    ) -> AuditLog:
        """
        Append a new tamper-evident record to the session's hash chain.
        H_n = SHA256(H_(n-1) || CanonicalJSON(Event_n))
        """
        # Fetch latest audit record for session to get previous hash and sequence
        stmt = (
            select(AuditLog)
            .where(AuditLog.session_id == session_id)
            .order_by(desc(AuditLog.sequence_id))
            .limit(1)
        )
        result = await self.db.execute(stmt)
        last_record = result.scalar_one_or_none()

        if last_record is None:
            sequence_id = 1
            prev_hash = GENESIS_PREV_HASH
        else:
            sequence_id = last_record.sequence_id + 1
            prev_hash = last_record.event_hash

        event_hash = AuditLedgerChainer.compute_hash(
            prev_hash=prev_hash,
            sequence_id=sequence_id,
            session_id=str(session_id),
            event_type=event_type.value,
            trust_state=trust_state.value,
            payload=payload,
        )

        audit_log = AuditLog(
            session_id=session_id,
            sequence_id=sequence_id,
            event_type=event_type.value,
            prev_event_hash=prev_hash,
            event_hash=event_hash,
            trust_state=trust_state.value,
            payload_json=payload,
        )
        self.db.add(audit_log)
        await self.db.flush()

        logger.debug(
            f"Audit log appended: session={session_id}, seq={sequence_id}, type={event_type.value}, hash={event_hash[:12]}..."
        )
        return audit_log

    async def get_session_audit_logs(self, session_id: UUID) -> List[AuditLog]:
        """Retrieve all audit logs for a session in sequential order."""
        stmt = (
            select(AuditLog)
            .where(AuditLog.session_id == session_id)
            .order_by(AuditLog.sequence_id.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def verify_session_chain(self, session_id: UUID) -> Tuple[bool, int, Optional[int], Optional[str]]:
        """
        Verify the complete cryptographic hash chain for a session.
        Returns: (is_valid, total_records, corrupted_sequence_id, error_detail)
        """
        records = await self.get_session_audit_logs(session_id)
        if not records:
            return True, 0, None, None

        is_valid, corrupted_seq, detail = AuditLedgerChainer.verify_chain(records)
        if not is_valid:
            logger.error(
                f"AUDIT TAMPER DETECTED for session {session_id} at sequence {corrupted_seq}: {detail}"
            )
        return is_valid, len(records), corrupted_seq, detail
