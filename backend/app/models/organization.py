"""
SQLAlchemy Entity Models: Organization, User, and Declarative Policy.
Enforces multi-tenancy and RBAC roles.
"""

import uuid
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.base import UniversalUUID, utc_now


class Organization(Base):
    """Multi-tenant organization boundary."""
    __tablename__ = "organizations"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False)
    tenant_code = Column(String(64), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    policies = relationship("Policy", back_populates="organization", cascade="all, delete-orphan")
    speaker_profiles = relationship("SpeakerProfile", back_populates="organization", cascade="all, delete-orphan")
    call_sessions = relationship("CallSession", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    """Tenant-scoped user (Operators, Security Analysts, Admins)."""
    __tablename__ = "users"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    org_id = Column(UniversalUUID, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    role = Column(String(50), nullable=False)  # OPERATOR, SECURITY_ANALYST, ORG_ADMIN, FORENSIC_AUDITOR
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    organization = relationship("Organization", back_populates="users")


class Policy(Base):
    """Declarative tenant security policy defining risk thresholds and action rules."""
    __tablename__ = "policies"

    id = Column(UniversalUUID, primary_key=True, default=uuid.uuid4)
    org_id = Column(UniversalUUID, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_name = Column(String(100), nullable=False)
    caution_threshold = Column(Float, nullable=False, default=30.0)
    verify_threshold = Column(Float, nullable=False, default=60.0)
    block_threshold = Column(Float, nullable=False, default=80.0)
    enforce_transaction_lock = Column(Boolean, nullable=False, default=True)
    sensitive_amount_threshold = Column(Float, nullable=False, default=250000.0)
    oob_timeout_seconds = Column(Integer, nullable=False, default=30)
    version = Column(String(32), nullable=False, default="1.0.0")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    organization = relationship("Organization", back_populates="policies")
    security_actions = relationship("SecurityAction", back_populates="policy")
