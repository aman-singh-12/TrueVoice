"""
TrueVoice Risk Assessment and History Service.
Manages storage, retrieval, and telemetry timeline of risk assessments and conversation analysis.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import logging

from app.models.risk_assessment import RiskAssessment, ConversationAnalysis
from app.models.call_session import CallSession
from app.schemas.risk import RiskAssessmentResponse
from app.core.constants import RiskTier, AuditEventType, TrustState
from app.core.exceptions import ResourceNotFoundError
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class RiskService:
    """Service handling risk evaluation storage and timeline queries."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit_service = AuditService(db)

    async def record_assessment(
        self,
        session_id: UUID,
        sequence_id: int,
        synthetic_prob: float,
        speaker_similarity: Optional[float],
        forensic_score: float,
        conversational_score: float,
        composite_risk: float,
        risk_tier: RiskTier,
        primary_factors: List[str],
        evidence_provenance: Dict[str, Any],
        model_version_id: Optional[UUID] = None
    ) -> RiskAssessment:
        """Persist a windowed risk evaluation record."""
        assessment = RiskAssessment(
            session_id=session_id,
            model_version_id=model_version_id,
            sequence_id=sequence_id,
            synthetic_prob=synthetic_prob,
            speaker_similarity=speaker_similarity,
            forensic_score=forensic_score,
            conversational_score=conversational_score,
            composite_risk=composite_risk,
            risk_tier=risk_tier.value,
            primary_factors=primary_factors,
            evidence_provenance=evidence_provenance,
        )
        self.db.add(assessment)

        # Update peak risk on CallSession
        session = await self.db.get(CallSession, session_id)
        if session and composite_risk > session.peak_risk_score:
            session.peak_risk_score = composite_risk

        # Audit log high/critical risk events
        if risk_tier in (RiskTier.HIGH, RiskTier.CRITICAL) and session:
            await self.audit_service.log_event(
                session_id=session_id,
                event_type=AuditEventType.RISK_ASSESSED,
                trust_state=TrustState(session.current_trust_state),
                payload={
                    "sequence_id": sequence_id,
                    "composite_risk": composite_risk,
                    "risk_tier": risk_tier.value,
                    "primary_factors": primary_factors,
                }
            )

        await self.db.commit()
        await self.db.refresh(assessment)
        return assessment

    async def record_conversation_analysis(
        self,
        session_id: UUID,
        sequence_id: int,
        transcript_redacted: str,
        detected_intent_flags: List[str],
        threat_level: str,
        confidence: float
    ) -> ConversationAnalysis:
        """Persist speech transcription and intent analysis."""
        analysis = ConversationAnalysis(
            session_id=session_id,
            sequence_id=sequence_id,
            transcript_redacted=transcript_redacted,
            detected_intent_flags=detected_intent_flags,
        )
        self.db.add(analysis)
        await self.db.commit()
        await self.db.refresh(analysis)
        return analysis

    async def get_session_assessments(
        self,
        session_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[RiskAssessment]:
        """Fetch chronological risk assessment history for a session."""
        stmt = (
            select(RiskAssessment)
            .where(RiskAssessment.session_id == session_id)
            .order_by(RiskAssessment.sequence_id.asc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_latest_assessment(self, session_id: UUID) -> Optional[RiskAssessment]:
        """Fetch most recent assessment for session."""
        stmt = (
            select(RiskAssessment)
            .where(RiskAssessment.session_id == session_id)
            .order_by(desc(RiskAssessment.sequence_id))
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
