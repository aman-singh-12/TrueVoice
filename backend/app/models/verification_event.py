"""
SQLAlchemy Entity Model: VerificationEvent.
Tracks secondary verification challenges, nonces, and cryptographic validation.
"""

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.constants import ChallengeStatus, ChallengeType
from app.db.session import Base
from app.models.base import UniversalUUID, utc_now


class VerificationEvent(Base):
    """Secondary challenge-response record bound to session, user, and nonce."""
    __tablename__ = "verification_events"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    session_id = Column(UniversalUUID, ForeignKey("call_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_type = Column(String(32), nullable=False, default=ChallengeType.OOB_PUSH.value)
    challenge_token = Column(String(64), nullable=False, unique=True, index=True)
    nonce = Column(String(64), nullable=False)
    status = Column(String(32), nullable=False, default=ChallengeStatus.PENDING.value)
    attempt_count = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    dispatched_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    session = relationship("CallSession", back_populates="verification_events")
