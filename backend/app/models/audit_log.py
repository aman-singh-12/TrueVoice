"""
SQLAlchemy Entity Model: AuditLog.
Implements in-database tamper-evident SHA-256 hash chaining:
H_n = SHA256(H_(n-1) || CanonicalJSON(Event_n))
"""

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import UniversalUUID, utc_now


class AuditLog(Base):
    """Cryptographically chained tamper-evident audit record."""
    __tablename__ = "audit_logs"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    session_id = Column(UniversalUUID, ForeignKey("call_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_id = Column(Integer, nullable=False, index=True)
    event_type = Column(String(64), nullable=False)
    prev_event_hash = Column(String(64), nullable=False)
    event_hash = Column(String(64), nullable=False, unique=True, index=True)
    trust_state = Column(String(32), nullable=False)
    payload_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    session = relationship("CallSession", back_populates="audit_logs")
