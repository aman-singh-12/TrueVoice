"""
FastAPI Route Dependencies for TrueVoice.
Handles async DB session injection, JWT bearer authentication, role-based access control,
and tenant boundary enforcement.
"""

from typing import AsyncGenerator, Callable, List, Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.constants import Role
from app.core.exceptions import AuthenticationError, AuthorizationError, TenantAccessViolation
from app.core.security import decode_token, enforce_tenant_isolation
from app.db.session import get_db_session

security_bearer = HTTPBearer(auto_error=True)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency yielding an async database session with automatic commit/rollback."""
    async for session in get_db_session():
        yield session


class AuthenticatedUser:
    """Represents the authenticated actor context extracted from JWT."""
    def __init__(self, user_id: str, org_id: str, role: Role):
        self.user_id = user_id
        self.org_id = org_id
        self.role = role

    def __repr__(self) -> str:
        return f"<User {self.user_id} (Org: {self.org_id}, Role: {self.role})>"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security_bearer),
) -> AuthenticatedUser:
    """
    Validate Bearer JWT and return AuthenticatedUser context.
    Raises 401 Unauthorized on invalid/expired token.
    """
    token = credentials.credentials
    try:
        payload = decode_token(token, settings.SECRET_KEY)
        user_id = payload.get("sub")
        org_id = payload.get("org_id")
        role_str = payload.get("role")

        if not user_id or not org_id or not role_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload structure",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return AuthenticatedUser(
            user_id=user_id,
            org_id=org_id,
            role=Role(role_str),
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_roles(allowed_roles: List[Role]) -> Callable:
    """RBAC dependency ensuring user has one of the allowed roles."""
    async def role_checker(
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Action requires one of {[r.value for r in allowed_roles]}",
            )
        return current_user

    return role_checker
