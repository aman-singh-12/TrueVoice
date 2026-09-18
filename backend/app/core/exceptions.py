"""
TrueVoice Domain Exceptions.
Provides standardized error codes and hierarchical exception handling.
"""

from typing import Optional, Dict, Any


class TrueVoiceException(Exception):
    """Base exception for all TrueVoice errors."""
    def __init__(self, message: str, error_code: str = "INTERNAL_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}


class AuthenticationError(TrueVoiceException):
    """Raised when authentication fails or token is invalid."""
    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code="AUTHENTICATION_FAILED", details=details)


class AuthorizationError(TrueVoiceException):
    """Raised when user does not have permission for an action."""
    def __init__(self, message: str = "Permission denied", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code="PERMISSION_DENIED", details=details)


class TenantAccessViolation(TrueVoiceException):
    """Raised when attempting cross-tenant access without authorization."""
    def __init__(self, message: str = "Cross-tenant access violation", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code="TENANT_ACCESS_VIOLATION", details=details)


class ResourceNotFoundError(TrueVoiceException):
    """Raised when an entity is not found within tenant scope."""
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            f"{resource} '{identifier}' not found or access unauthorized",
            error_code="RESOURCE_NOT_FOUND",
            details={"resource": resource, "identifier": identifier}
        )


class AudioProcessingError(TrueVoiceException):
    """Raised when audio decoding, validation, or resampling fails."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code="AUDIO_PROCESSING_ERROR", details=details)


class ModelUnavailableError(TrueVoiceException):
    """Raised when a configured ML model fails to load or execute."""
    def __init__(self, model_name: str, reason: str):
        super().__init__(
            f"Model '{model_name}' is unavailable: {reason}",
            error_code="MODEL_UNAVAILABLE",
            details={"model_name": model_name, "reason": reason}
        )


class PolicyEvaluationError(TrueVoiceException):
    """Raised when policy evaluation fails."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code="POLICY_EVALUATION_ERROR", details=details)


class VerificationError(TrueVoiceException):
    """Raised when secondary verification ceremony encounters an error."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code="VERIFICATION_ERROR", details=details)


class AuditTamperDetectedError(TrueVoiceException):
    """Raised when hash chain verification detects modified records."""
    def __init__(self, sequence_id: int, expected_hash: str, actual_hash: str):
        super().__init__(
            f"Audit ledger tampering detected at sequence {sequence_id}",
            error_code="AUDIT_TAMPER_DETECTED",
            details={
                "sequence_id": sequence_id,
                "expected_hash": expected_hash,
                "actual_hash": actual_hash
            }
        )


class InvalidStateTransitionException(TrueVoiceException):
    """Raised when an illegal state machine transition is attempted."""
    def __init__(self, current_state: str, attempted_state: str, reason: Optional[str] = None):
        msg = f"Cannot transition from {current_state} to {attempted_state}"
        if reason:
            msg += f": {reason}"
        super().__init__(
            msg,
            error_code="INVALID_STATE_TRANSITION",
            details={
                "current_state": current_state,
                "attempted_state": attempted_state,
                "reason": reason
            }
        )

