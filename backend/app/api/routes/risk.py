"""
TrueVoice Risk Telemetry API Endpoints.
Provides historical risk progression and latest assessments for analyst monitoring.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import RiskTier
from app.dependencies import get_db, get_current_user, AuthenticatedUser
from app.schemas.risk import RiskAssessmentResponse
from app.services.session_service import SessionService
from app.services.risk_service import RiskService

router = APIRouter(prefix="/v1/risk", tags=["Risk Intelligence"])


@router.get("/{session_id}/timeline", response_model=List[RiskAssessmentResponse])
async def get_risk_timeline(
    session_id: UUID,
    skip: int = 0,
    limit: int = 100,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve chronological windowed risk assessments for a session."""
    session_service = SessionService(db)
    # Enforce tenant isolation
    await session_service.get_session(session_id, UUID(current_user.org_id))

    risk_service = RiskService(db)
    assessments = await risk_service.get_session_assessments(session_id=session_id, skip=skip, limit=limit)

    return [
        RiskAssessmentResponse(
            id=str(a.id),
            session_id=str(a.session_id),
            sequence_id=a.sequence_id,
            synthetic_prob=a.synthetic_prob,
            speaker_similarity=a.speaker_similarity,
            forensic_score=a.forensic_score,
            conversational_score=a.conversational_score,
            composite_risk=a.composite_risk,
            risk_tier=RiskTier(a.risk_tier),
            primary_factors=a.primary_factors,
            evidence_provenance=a.evidence_provenance,
            recorded_at=a.recorded_at,
        )
        for a in assessments
    ]


@router.get("/{session_id}/latest", response_model=Optional[RiskAssessmentResponse])
async def get_latest_risk(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve the most recent risk assessment for a session."""
    session_service = SessionService(db)
    await session_service.get_session(session_id, UUID(current_user.org_id))

    risk_service = RiskService(db)
    a = await risk_service.get_latest_assessment(session_id=session_id)
    if not a:
        return None

    return RiskAssessmentResponse(
        id=str(a.id),
        session_id=str(a.session_id),
        sequence_id=a.sequence_id,
        synthetic_prob=a.synthetic_prob,
        speaker_similarity=a.speaker_similarity,
        forensic_score=a.forensic_score,
        conversational_score=a.conversational_score,
        composite_risk=a.composite_risk,
        risk_tier=RiskTier(a.risk_tier),
        primary_factors=a.primary_factors,
        evidence_provenance=a.evidence_provenance,
        recorded_at=a.recorded_at,
    )
