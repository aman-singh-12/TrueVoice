"""
SQLAlchemy Entity Models: RiskAssessment and ConversationAnalysis.
Captures windowed risk assessments with full signal provenance and speech analysis.
"""

import uuid
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import UniversalUUID, utc_now


class RiskAssessment(Base):
    """Windowed risk assessment telemetry per audio hop with signal provenance."""
    __tablename__ = "risk_assessments"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    session_id = Column(UniversalUUID, ForeignKey("call_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    model_version_id = Column(UniversalUUID, ForeignKey("model_versions.id", ondelete="SET NULL"), nullable=True)
    sequence_id = Column(Integer, nullable=False)
    synthetic_prob = Column(Float, nullable=False)        # S_df (0.0 - 100.0)
    speaker_similarity = Column(Float, nullable=True)     # S_speaker (0.0 - 1.0)
    forensic_score = Column(Float, nullable=False)        # S_forensic (0.0 - 100.0)
    conversational_score = Column(Float, nullable=False)  # S_conv (0.0 - 1.0)
    composite_risk = Column(Float, nullable=False)        # Composite score (0.0 - 100.0)
    risk_tier = Column(String(16), nullable=False)        # LOW, MODERATE, HIGH, CRITICAL
    primary_factors = Column(JSON, nullable=False, default=list)
    evidence_provenance = Column(JSON, nullable=False, default=dict)  # Full provenance per signal
    recorded_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    # Relationships
    session = relationship("CallSession", back_populates="risk_assessments")
    model_version = relationship("ModelVersion", back_populates="risk_assessments")


class ConversationAnalysis(Base):
    """Redacted speech transcripts and conversational intent flags."""
    __tablename__ = "conversation_analyses"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    session_id = Column(UniversalUUID, ForeignKey("call_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_id = Column(Integer, nullable=False)
    transcript_redacted = Column(Text, nullable=False)
    detected_intent_flags = Column(JSON, nullable=False, default=list)
    recorded_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    session = relationship("CallSession", back_populates="conversation_analyses")
