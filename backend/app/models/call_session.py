"""
SQLAlchemy Entity Model: CallSession.
Manages active voice interaction sessions, trust states, peak risk, and gateway metadata.
"""

import uuid
from sqlalchemy import Column, DateTime, Float, ForeignKey, JSON, String
from sqlalchemy.orm import relationship

from app.core.constants import TrustState
from app.db.session import Base
from app.models.base import UniversalUUID, utc_now


class CallSession(Base):
    """Monitored voice interaction session."""
    __tablename__ = "call_sessions"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    org_id = Column(UniversalUUID, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token = Column(String(64), unique=True, nullable=False, index=True)
    claimed_speaker_id = Column(
        UniversalUUID, ForeignKey("speaker_profiles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    caller_ani = Column(String(32), nullable=False, default="UNKNOWN")  # Optional gateway metadata
    context_metadata = Column(JSON, nullable=False, default=dict)
    current_trust_state = Column(String(32), nullable=False, default=TrustState.OBSERVING.value)
    peak_risk_score = Column(Float, nullable=False, default=0.0)
    started_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="call_sessions")
    claimed_speaker = relationship("SpeakerProfile", back_populates="call_sessions")
    risk_assessments = relationship("RiskAssessment", back_populates="session", cascade="all, delete-orphan")
    conversation_analyses = relationship("ConversationAnalysis", back_populates="session", cascade="all, delete-orphan")
    verification_events = relationship("VerificationEvent", back_populates="session", cascade="all, delete-orphan")
    security_actions = relationship("SecurityAction", back_populates="session", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="session", cascade="all, delete-orphan")
