"""
SQLAlchemy Entity Model: SecurityAction.
Records policy enforcement decisions, triggers, and execution status.
"""

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.core.constants import ActionExecutionStatus, ActionTriggerSource, SecurityActionType
from app.db.session import Base
from app.models.base import UniversalUUID, utc_now


class SecurityAction(Base):
    """Enforced security mitigation or alert action."""
    __tablename__ = "security_actions"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    session_id = Column(UniversalUUID, ForeignKey("call_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_id = Column(UniversalUUID, ForeignKey("policies.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(
        String(64), nullable=False, default=SecurityActionType.ALLOW.value
    )  # ALLOW, WARN, REQUEST_VERIFICATION, RESTRICT, BLOCK, HUMAN_REVIEW
    triggered_by = Column(String(32), nullable=False, default=ActionTriggerSource.POLICY_AUTO.value)
    triggering_reason = Column(Text, nullable=False)
    execution_status = Column(String(32), nullable=False, default=ActionExecutionStatus.PENDING.value)
    executed_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    session = relationship("CallSession", back_populates="security_actions")
    policy = relationship("Policy", back_populates="security_actions")
