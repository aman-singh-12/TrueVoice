"""
SQLAlchemy Entity Model: ModelVersion.
Maintains model lineage, checkpoint digests, and version metadata for full traceability.
"""

import uuid
from sqlalchemy import Column, DateTime, JSON, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import UniversalUUID, utc_now


class ModelVersion(Base):
    """Traceability record for active and historical AI/ML models."""
    __tablename__ = "model_versions"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    model_name = Column(String(100), nullable=False)  # wav2vec2, rawnet2, aasist, ecapa, whisper
    version_tag = Column(String(50), nullable=False, unique=True, index=True)
    weights_digest = Column(String(64), nullable=False)  # SHA-256 hash of model weights
    checkpoint_uri = Column(String(255), nullable=True)
    configuration = Column(JSON, nullable=False, default=dict)
    deployed_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    # Relationships
    risk_assessments = relationship("RiskAssessment", back_populates="model_version")
