"""
TrueVoice Audit Ledger API Endpoints.
Exposes tamper-evident SHA-256 hash chain entries and full chain integrity verification.
"""

from datetime import datetime, timezone
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import Role, AuditEventType, TrustState
from app.dependencies import get_db, get_current_user, AuthenticatedUser, require_roles
from app.schemas.audit import AuditLogResponse, AuditChainValidationResult
from app.services.session_service import SessionService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/v1/audit", tags=["Audit Ledger"])


@router.get("/{session_id}/logs", response_model=List[AuditLogResponse])
async def get_session_audit_logs(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(require_roles([Role.SECURITY_ANALYST, Role.ORG_ADMIN, Role.FORENSIC_AUDITOR])),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve the sequential, cryptographically chained audit log for a session."""
    session_service = SessionService(db)
    await session_service.get_session(session_id, UUID(current_user.org_id))

    audit_service = AuditService(db)
    records = await audit_service.get_session_audit_logs(session_id)

    return [
        AuditLogResponse(
            id=str(r.id),
            session_id=str(r.session_id),
            sequence_id=r.sequence_id,
            event_type=AuditEventType(r.event_type),
            prev_event_hash=r.prev_event_hash,
            event_hash=r.event_hash,
            trust_state=TrustState(r.trust_state),
            payload_json=r.payload_json,
            created_at=r.created_at,
        )
        for r in records
    ]


@router.get("/{session_id}/verify-chain", response_model=AuditChainValidationResult)
async def verify_audit_chain(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(require_roles([Role.SECURITY_ANALYST, Role.ORG_ADMIN, Role.FORENSIC_AUDITOR])),
    db: AsyncSession = Depends(get_db)
):
    """
    Execute mathematical SHA-256 hash chain verification across all session audit records.
    H_n = SHA256(H_(n-1) || CanonicalJSON(Event_n))
    """
    session_service = SessionService(db)
    await session_service.get_session(session_id, UUID(current_user.org_id))

    audit_service = AuditService(db)
    is_valid, total_events, tampered_seq, detail = await audit_service.verify_session_chain(session_id)

    message = (
        f"Chain integrity verified across {total_events} records."
        if is_valid
        else f"TAMPERING DETECTED at sequence {tampered_seq}: {detail}"
    )

    return AuditChainValidationResult(
        session_id=str(session_id),
        total_events=total_events,
        is_valid=is_valid,
        verified_at=datetime.now(timezone.utc),
        tampered_at_sequence=tampered_seq,
        message=message,
    )
