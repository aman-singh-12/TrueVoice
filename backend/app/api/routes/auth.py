"""
TrueVoice Authentication & Authorization API Endpoints.
Handles JWT issuance, password verification, and short-lived WebSocket ticket generation.
"""

from datetime import timedelta
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.core.security import verify_password, hash_password, create_access_token, create_websocket_token
from app.core.constants import Role
from app.dependencies import get_db, get_current_user, AuthenticatedUser
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    SessionTokenRequest,
    SessionTokenResponse,
)
from app.services.session_service import SessionService

router = APIRouter(prefix="/v1/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a new operator or analyst account with organization assignment and JWT issuance.
    """
    stmt = select(User).where(User.email == request.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    org_name = (request.organization_name or "TrueVoice Security Operations").strip()
    org_stmt = select(Organization).where(Organization.name == org_name)
    org_res = await db.execute(org_stmt)
    org = org_res.scalar_one_or_none()

    if not org:
        code_prefix = re.sub(r"[^A-Z0-9]", "", org_name.upper())[:8] or "TVORG"
        tenant_code = f"{code_prefix}_{uuid.uuid4().hex[:6].upper()}"
        org = Organization(
            id=uuid.uuid4(),
            name=org_name,
            tenant_code=tenant_code,
            is_active=True,
        )
        db.add(org)
        await db.flush()

    new_user = User(
        id=uuid.uuid4(),
        org_id=org.id,
        email=request.email,
        full_name=request.full_name,
        role=request.role.value if isinstance(request.role, Role) else str(request.role),
        password_hash=hash_password(request.password),
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    settings = get_settings()
    access_token = create_access_token(
        subject=str(new_user.id),
        org_id=str(new_user.org_id),
        role=new_user.role,
        secret_key=settings.secret_key,
        expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_minutes=settings.jwt_access_token_expire_minutes,
        user_id=str(new_user.id),
        org_id=str(new_user.org_id),
        role=Role(new_user.role),
    )


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
