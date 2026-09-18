"""
SQLAlchemy Entity Models: SpeakerProfile and VoiceprintEmbedding.
Stores enrolled biometric identities and 192-d vectors.
"""

import uuid
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import UniversalUUID, Vector192, utc_now


class SpeakerProfile(Base):
    """Enrolled biometric identity for an executive, VIP, or trusted caller."""
    __tablename__ = "speaker_profiles"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    org_id = Column(UniversalUUID, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UniversalUUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    display_name = Column(String(150), nullable=False)
    designation = Column(String(100), nullable=False)
    consent_timestamp = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    # Relationships
    organization = relationship("Organization", back_populates="speaker_profiles")
    voiceprints = relationship("VoiceprintEmbedding", back_populates="speaker_profile", cascade="all, delete-orphan")
    call_sessions = relationship("CallSession", back_populates="claimed_speaker")


class VoiceprintEmbedding(Base):
    """192-dimensional unit-hypersphere speaker embedding vector."""
    __tablename__ = "voiceprint_embeddings"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    speaker_profile_id = Column(
        UniversalUUID, ForeignKey("speaker_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    embedding = Column(Vector192, nullable=False)
    quality_score = Column(Float, nullable=False, default=1.0)
    sample_duration_seconds = Column(Float, nullable=False)
    enrolled_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    speaker_profile = relationship("SpeakerProfile", back_populates="voiceprints")
