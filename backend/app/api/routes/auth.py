"""
TrueVoice Authentication & Authorization API Endpoints.
Handles JWT issuance, password verification, and short-lived WebSocket ticket generation.
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.core.security import verify_password, create_access_token, create_websocket_token
from app.core.constants import Role
from app.dependencies import get_db, get_current_user, AuthenticatedUser
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, SessionTokenRequest, SessionTokenResponse
from app.services.session_service import SessionService

router = APIRouter(prefix="/v1/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user with email and password, issuing a tenant-scoped JWT."""
    stmt = select(User).where(User.email == credentials.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    settings = get_settings()
    access_token = create_access_token(
        subject=str(user.id),
        org_id=str(user.org_id),
        role=user.role,
        secret_key=settings.secret_key,
        expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_minutes=settings.jwt_access_token_expire_minutes,
        user_id=str(user.id),
        org_id=str(user.org_id),
        role=Role(user.role),
    )


@router.post("/session-token", response_model=SessionTokenResponse)
async def create_ws_session_ticket(
    request: SessionTokenRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Issue a short-lived (5 min), session-scoped ticket token for WebSocket streaming.
    Guarantees long-lived JWT credentials are never transmitted in URL query strings.
    """
    session_service = SessionService(db)
    # Validate session exists and belongs to user's organization
    session = await session_service.get_session(request.session_id, current_user.org_id)

    settings = get_settings()
    ticket = create_websocket_token(
        session_id=str(session.id),
        user_id=current_user.user_id,
        org_id=current_user.org_id,
        role=current_user.role.value,
        secret_key=settings.secret_key,
        expires_delta=timedelta(seconds=settings.ws_ticket_expire_seconds),
    )

    return SessionTokenResponse(
        ticket_token=ticket,
        token_type="ticket",
        expires_in_seconds=settings.ws_ticket_expire_seconds,
        session_id=str(session.id),
    )


@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve current authenticated user context."""
    user = await db.get(User, current_user.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
