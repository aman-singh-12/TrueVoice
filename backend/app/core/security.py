"""
TrueVoice Security & Authentication Utilities.
Handles bcrypt password hashing, JWT token creation/decoding, and tenant validation.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import uuid

import bcrypt
from jose import jwt, JWTError

from app.core.exceptions import AuthenticationError, AuthorizationError, TenantAccessViolation


# Default algorithms and token lifetimes
ALGORITHM = "HS256"
DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = 15
DEFAULT_WS_TOKEN_EXPIRE_MINUTES = 5


def hash_password(password: str) -> str:
    """Hash plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against bcrypt hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(
    subject: str,
    org_id: str,
    role: str,
    secret_key: str,
    expires_delta: Optional[timedelta] = None,
    additional_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate short-lived JWT access token with tenant context.
    Never exposes unnecessary sensitive identity data.
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES))
    
    payload = {
        "sub": str(subject),
        "org_id": str(org_id),
        "role": str(role),
        "iat": now,
        "exp": expire,
        "jti": str(uuid.uuid4()),
    }
    if additional_claims:
        payload.update(additional_claims)

    return jwt.encode(payload, secret_key, algorithm=ALGORITHM)


def create_websocket_token(
    session_id: str,
    user_id: str,
    org_id: str,
    role: str,
    secret_key: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generate ultra-short-lived (5 min), session-scoped WebSocket streaming token.
    Must never be reused across sessions or organizations.
    """
    claims = {
        "scope": "websocket_stream",
        "session_id": str(session_id),
    }
    return create_access_token(
        subject=user_id,
        org_id=org_id,
        role=role,
        secret_key=secret_key,
        expires_delta=expires_delta or timedelta(minutes=DEFAULT_WS_TOKEN_EXPIRE_MINUTES),
        additional_claims=claims,
    )


def decode_token(token: str, secret_key: str) -> Dict[str, Any]:
    """Decode and validate a signed JWT token."""
    try:
        payload = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError as exc:
        raise AuthenticationError(f"Invalid or expired token: {str(exc)}")


def enforce_tenant_isolation(token_org_id: str, requested_org_id: str) -> None:
    """
    Enforce multi-tenant organizational boundary.
    Raises TenantAccessViolation if caller attempts cross-tenant access.
    """
    if str(token_org_id) != str(requested_org_id):
        raise TenantAccessViolation(
            f"Access denied: User belongs to organization {token_org_id}, "
            f"attempted access to {requested_org_id}"
        )
