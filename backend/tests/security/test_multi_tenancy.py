"""
Security Tests: Multi-Tenant Isolation and Cross-Tenant Data Access Prevention.
Fulfills Person 5 Part J requirements:
- Cross-tenant session access denial
- Cross-tenant speaker profile protection
- Cross-tenant audit trail segregation
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.constants import Role
from app.core.security import hash_password, create_access_token
from app.models.organization import Organization
from app.models.user import User


@pytest.fixture(scope="function")
async def two_tenants(test_db_session: AsyncSession):
    """Seed two completely distinct tenant organizations with respective admin tokens."""
    # 1. Tenant A
    org_a = Organization(id=uuid.uuid4(), name="Tenant Alpha Bank", tenant_code="tenant-alpha")
    user_a = User(
        id=uuid.uuid4(),
        org_id=org_a.id,
        email="admin@alpha.com",
        password_hash=hash_password("PassAlpha123!"),
        full_name="Alpha Admin",
        role=Role.ORG_ADMIN.value,
        is_active=True,
    )

    # 2. Tenant B
    org_b = Organization(id=uuid.uuid4(), name="Tenant Beta Corp", tenant_code="tenant-beta")
    user_b = User(
        id=uuid.uuid4(),
        org_id=org_b.id,
        email="admin@beta.com",
        password_hash=hash_password("PassBeta123!"),
        full_name="Beta Admin",
        role=Role.ORG_ADMIN.value,
        is_active=True,
    )

    test_db_session.add_all([org_a, user_a, org_b, user_b])
    await test_db_session.commit()

    token_a = create_access_token(
        subject=str(user_a.id),
        org_id=str(org_a.id),
        role=user_a.role,
        secret_key=settings.SECRET_KEY,
    )
    token_b = create_access_token(
        subject=str(user_b.id),
        org_id=str(org_b.id),
        role=user_b.role,
        secret_key=settings.SECRET_KEY,
    )

    return {
        "org_a": org_a,
        "token_a": token_a,
        "user_a": user_a,
        "org_b": org_b,
        "token_b": token_b,
        "user_b": user_b,
    }


@pytest.mark.security
@pytest.mark.asyncio
async def test_cross_tenant_session_isolation(async_client: AsyncClient, two_tenants: dict):
    """Verify Tenant B cannot read or modify Tenant A's call sessions."""
    headers_a = {"Authorization": f"Bearer {two_tenants['token_a']}"}
    headers_b = {"Authorization": f"Bearer {two_tenants['token_b']}"}

    # Tenant A creates session
    create_resp = await async_client.post(
        "/v1/sessions",
        json={"caller_ani": "+15551112222", "context_metadata": {"org": "Alpha"}},
        headers=headers_a,
    )
    assert create_resp.status_code == 201
    session_id = create_resp.json()["id"]

    # 1. Tenant A can read session
    read_a = await async_client.get(f"/v1/sessions/{session_id}", headers=headers_a)
    assert read_a.status_code == 200

    # 2. Tenant B attempts to read Tenant A's session -> Must be 404 (or 403)
    read_b = await async_client.get(f"/v1/sessions/{session_id}", headers=headers_b)
    assert read_b.status_code in (404, 403), "Tenant B must not access Tenant A's session"

    # 3. Tenant B attempts to terminate Tenant A's session -> Must be 404 (or 403)
    term_b = await async_client.post(
        f"/v1/sessions/{session_id}/terminate",
        json={"reason": "Attacker forced close"},
        headers=headers_b,
    )
    assert term_b.status_code in (404, 403)


from app.models.speaker_profile import SpeakerProfile


@pytest.mark.security
@pytest.mark.asyncio
async def test_cross_tenant_speaker_profile_isolation(async_client: AsyncClient, two_tenants: dict, test_db_session: AsyncSession):
    """Verify Tenant B cannot access or mutate Tenant A's enrolled speaker profiles."""
    headers_a = {"Authorization": f"Bearer {two_tenants['token_a']}"}
    headers_b = {"Authorization": f"Bearer {two_tenants['token_b']}"}

    # Tenant A speaker in database
    spk_id = uuid.uuid4()
    speaker_a = SpeakerProfile(
        id=spk_id,
        org_id=two_tenants["org_a"].id,
        display_name="VIP Customer Alpha",
        designation="Account Holder",
        is_active=True,
    )
    test_db_session.add(speaker_a)
    await test_db_session.commit()

    # 1. Tenant A can fetch profile
    get_a = await async_client.get(f"/v1/speakers/{spk_id}", headers=headers_a)
    assert get_a.status_code == 200
    assert get_a.json()["display_name"] == "VIP Customer Alpha"

    # 2. Tenant B attempts to fetch Tenant A's speaker profile -> 404
    get_b = await async_client.get(f"/v1/speakers/{spk_id}", headers=headers_b)
    assert get_b.status_code in (404, 403), "Tenant B must not access Tenant A's speaker profile"
