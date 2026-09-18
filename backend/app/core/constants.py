"""
TrueVoice Core Constants and Enumerations.
Strictly decoupled into Identity, Risk, and Trust State dimensions.
"""

from enum import Enum


class Role(str, Enum):
    """User role within an organization."""
    OPERATOR = "OPERATOR"
    SECURITY_ANALYST = "SECURITY_ANALYST"
    ORG_ADMIN = "ORG_ADMIN"
    FORENSIC_AUDITOR = "FORENSIC_AUDITOR"


class IdentityStatus(str, Enum):
    """Identity verification status of the claimed speaker."""
    UNVERIFIED = "UNVERIFIED"
    VERIFIED = "VERIFIED"


class RiskTier(str, Enum):
    """
    Risk tier based on composite score:
    0-29: LOW (No Significant Risk Detected)
    30-59: MODERATE (Caution)
    60-79: HIGH (Enhanced Verification Required)
    80-100: CRITICAL (Immediate Security Action Required)
    """
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TrustState(str, Enum):
    """
    Zero-Trust State Machine states.
    Separated from raw risk scores and identity verification.
    """
    OBSERVING = "OBSERVING"
    CAUTION = "CAUTION"
    VERIFYING = "VERIFYING"
    TRUSTED = "TRUSTED"
    RESTRICTED = "RESTRICTED"
    BLOCKED = "BLOCKED"
    HUMAN_REVIEW = "HUMAN_REVIEW"
    TERMINATED = "TERMINATED"


class SecurityActionType(str, Enum):
    """Actions dispatched by the declarative policy engine."""
    ALLOW = "ALLOW"
    WARN = "WARN"
    REQUEST_VERIFICATION = "REQUEST_VERIFICATION"
    RESTRICT = "RESTRICT"
    BLOCK = "BLOCK"
    HUMAN_REVIEW = "HUMAN_REVIEW"


class ActionTriggerSource(str, Enum):
    """Source that initiated the security action."""
    POLICY_AUTO = "POLICY_AUTO"
    OPERATOR_MANUAL = "OPERATOR_MANUAL"
    ANALYST_OVERRIDE = "ANALYST_OVERRIDE"


class ActionExecutionStatus(str, Enum):
    """Execution status of an action."""
    PENDING = "PENDING"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"


class ChallengeType(str, Enum):
    """Secondary verification challenge type."""
    OOB_PUSH = "OOB_PUSH"
    IN_BAND_CHALLENGE = "IN_BAND_CHALLENGE"
    SECURE_CALLBACK = "SECURE_CALLBACK"


class ChallengeStatus(str, Enum):
    """Status of a verification challenge."""
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    TIMEOUT = "TIMEOUT"
    REJECTED = "REJECTED"


class SignalAvailability(str, Enum):
    """Explicit availability tracking for multi-signal risk fusion."""
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"


class AuditEventType(str, Enum):
    """Standardized events recorded in the tamper-evident hash chain."""
    SESSION_CREATED = "SESSION_CREATED"
    SPEAKER_ENROLLED = "SPEAKER_ENROLLED"
    RISK_ASSESSED = "RISK_ASSESSED"
    STATE_TRANSITION = "STATE_TRANSITION"
    VERIFICATION_DISPATCHED = "VERIFICATION_DISPATCHED"
    VERIFICATION_RESOLVED = "VERIFICATION_RESOLVED"
    POLICY_ACTION_ENFORCED = "POLICY_ACTION_ENFORCED"
    ANALYST_OVERRIDE = "ANALYST_OVERRIDE"
    SESSION_TERMINATED = "SESSION_TERMINATED"
