"""
TrueVoice Secondary Verification API Endpoints.
Dispatches and verifies out-of-band cryptographic challenges.
"""

from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ChallengeStatus
from app.dependencies import get_db, get_current_user, AuthenticatedUser
from app.schemas.verification import ChallengeDispatch, ChallengeResponse, VerificationSubmit, VerificationResultSummary
from app.services.verification_service import VerificationService

router = APIRouter(prefix="/v1/verification", tags=["Secondary Verification"])


@router.post("/dispatch", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
async def dispatch_challenge(
    request: ChallengeDispatch,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Issue an out-of-band cryptographic challenge for an active voice session.
    Generates high-entropy nonce with 30s TTL.
    """
    service = VerificationService(db)
    event = await service.dispatch_challenge(
        session_id=UUID(request.session_id),
        org_id=UUID(current_user.org_id),
        challenge_type=request.challenge_type,
        ttl_seconds=30
    )

    ttl = max(0, int((event.expires_at - event.dispatched_at).total_seconds()))
    return ChallengeResponse(
        challenge_token=event.challenge_token,
        session_id=str(event.session_id),
        challenge_type=event.challenge_type,
        nonce=event.nonce,
        expires_at=event.expires_at,
        ttl_seconds=ttl,
        instructions="Simulated OOB challenge dispatched to enrolled user device",
    )


@router.post("/verify", response_model=VerificationResultSummary)
async def verify_challenge(
    submission: VerificationSubmit,
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Validate client response for active challenge.
    Updates session trust state on verification success or failure.
    """
    service = VerificationService(db)
    result = await service.submit_response(
        session_id=UUID(session_id),
        challenge_token=submission.challenge_token,
        client_response=submission.signature or submission.nonce,
        org_id=UUID(current_user.org_id)
    )

    return VerificationResultSummary(
        session_id=session_id,
        status=ChallengeStatus(result["status"]),
        message=result["reason"],
        verified_at=datetime.now(timezone.utc) if result["is_valid"] else None,
    )
