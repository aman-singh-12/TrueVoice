"""
TrueVoice Call Session API Endpoints.
Handles session creation, querying, termination, and analyst overrides.
"""

from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import Role, TrustState
from app.dependencies import get_db, get_current_user, AuthenticatedUser, require_roles
from app.schemas.session import SessionCreate, SessionResponse, SessionDetailResponse, AnalystOverrideRequest
from app.services.session_service import SessionService
from app.policy.state_machine import ZeroTrustStateMachine

router = APIRouter(prefix="/v1/sessions", tags=["Sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: SessionCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Initialize a new voice interaction session under tenant boundary."""
    session_service = SessionService(db)
    session = await session_service.create_session(org_id=UUID(current_user.org_id), data=data)
    return session


@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    skip: int = 0,
    limit: int = 50,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List sessions for the current tenant organization."""
    session_service = SessionService(db)
    return await session_service.list_sessions(org_id=UUID(current_user.org_id), skip=skip, limit=limit)


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session_details(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve detailed session metadata and status."""
    session_service = SessionService(db)
    session = await session_service.get_session(session_id=session_id, org_id=UUID(current_user.org_id))
    return session


@router.post("/{session_id}/terminate", response_model=SessionResponse)
async def terminate_session(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Conclude session and transition state to TERMINATED."""
    session_service = SessionService(db)
    return await session_service.terminate_session(
        session_id=session_id,
        org_id=UUID(current_user.org_id),
        actor_id=current_user.user_id
    )


@router.post("/{session_id}/override", response_model=SessionResponse)
async def analyst_override(
    session_id: UUID,
    request: AnalystOverrideRequest,
    current_user: AuthenticatedUser = Depends(require_roles([Role.SECURITY_ANALYST, Role.ORG_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Apply analyst human review decision:
    Actions: ANALYST_APPROVE -> TRUSTED, ANALYST_RESTRICT -> RESTRICTED, ANALYST_BLOCK -> BLOCKED.
    """
    session_service = SessionService(db)
    session = await session_service.get_session(session_id=session_id, org_id=UUID(current_user.org_id))

    current_state = TrustState(session.current_trust_state)
    fsm = ZeroTrustStateMachine(initial_state=current_state)
    from_state, to_state = fsm.handle_analyst_override(
        action=request.action,
        analyst_id=current_user.user_id,
        reason=request.reason
    )

    await session_service.transition_state(
        session=session,
        target_state=to_state,
        reason=f"Analyst override [{request.action}]: {request.reason}",
        actor_id=current_user.user_id
    )
    return session
