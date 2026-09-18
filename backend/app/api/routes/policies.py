"""
TrueVoice Security Policy API Endpoints.
Configures organizational thresholds and declarative security rules.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import Role
from app.dependencies import get_db, get_current_user, AuthenticatedUser, require_roles
from app.schemas.policy import PolicyCreate, PolicyResponse
from app.services.policy_service import PolicyService

router = APIRouter(prefix="/v1/policies", tags=["Policies"])


@router.get("", response_model=Optional[PolicyResponse])
async def get_active_policy(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve the active policy configuration for the current tenant."""
    service = PolicyService(db)
    policy = await service.get_active_policy(UUID(current_user.org_id))
    if not policy:
        return None

    return PolicyResponse(
        id=str(policy.id),
        org_id=str(policy.org_id),
        policy_name=policy.policy_name,
        caution_threshold=policy.caution_threshold,
        verify_threshold=policy.verify_threshold,
        block_threshold=policy.block_threshold,
        enforce_transaction_lock=policy.enforce_transaction_lock,
        sensitive_amount_threshold=policy.sensitive_amount_threshold,
        oob_timeout_seconds=policy.oob_timeout_seconds,
        version=policy.version,
        created_at=policy.created_at,
    )


@router.post("", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_policy(
    data: PolicyCreate,
    current_user: AuthenticatedUser = Depends(require_roles([Role.ORG_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Create a new active policy configuration for the tenant."""
    service = PolicyService(db)
    policy = await service.create_or_update_policy(UUID(current_user.org_id), data)

    return PolicyResponse(
        id=str(policy.id),
        org_id=str(policy.org_id),
        policy_name=policy.policy_name,
        caution_threshold=policy.caution_threshold,
        verify_threshold=policy.verify_threshold,
        block_threshold=policy.block_threshold,
        enforce_transaction_lock=policy.enforce_transaction_lock,
        sensitive_amount_threshold=policy.sensitive_amount_threshold,
        oob_timeout_seconds=policy.oob_timeout_seconds,
        version=policy.version,
        created_at=policy.created_at,
    )

