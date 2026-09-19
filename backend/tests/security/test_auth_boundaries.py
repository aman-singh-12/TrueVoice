"""
Security Tests: Authentication Boundaries and API Defensive Controls.
Fulfills Person 5 Part J requirements:
- Missing authentication
- Unauthorized session and audit access
- Forged and expired JWT tokens
- Invalid UUID parameter handling
- SQL injection boundary resilience
"""

import pytest
from httpx import AsyncClient
from datetime import timedelta
from uuid import uuid4

from app.core.security import create_access_token


@pytest.mark.security
@pytest.mark.asyncio
async def test_missing_authentication_denied(async_client: AsyncClient):
    """Verify that unauthenticated requests to protected endpoints return 401."""
    protected_endpoints = [
        ("GET", "/v1/auth/me"),
        ("GET", "/v1/sessions"),
        ("POST", "/v1/sessions"),
        ("GET", f"/v1/sessions/{uuid4()}"),
        ("GET", "/v1/speakers"),
        ("GET", f"/v1/audit/{uuid4()}/logs"),
    ]

    for method, path in protected_endpoints:
        if method == "GET":
            resp = await async_client.get(path)
        else:
            resp = await async_client.post(path, json={})

        assert resp.status_code == 401, f"Endpoint {method} {path} must require authentication (got {resp.status_code})"


@pytest.mark.security
@pytest.mark.asyncio
async def test_invalid_bearer_token_rejected(async_client: AsyncClient):
    """Verify that invalid or corrupt Bearer tokens return 401."""
    invalid_tokens = [
        "Bearer invalid_base64_string",
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.bogus_signature",
        "NotBearer eyJhbGciOiJIUzI1NiJ9.e30.sig",
        "Bearer ",
    ]

    for auth_header in invalid_tokens:
        resp = await async_client.get("/v1/auth/me", headers={"Authorization": auth_header})
        assert resp.status_code == 401


@pytest.mark.security
@pytest.mark.asyncio
async def test_forged_secret_key_token_rejected(async_client: AsyncClient, seeded_tenant: dict):
    """Verify that JWT signed with an attacker's rogue secret is rejected."""
    attacker_token = create_access_token(
        subject=str(seeded_tenant["admin"].id),
        org_id=str(seeded_tenant["org"].id),
        role="ORG_ADMIN",
        secret_key="attacker_rogue_secret_key_that_is_long_enough_for_hs256",
    )

    headers = {"Authorization": f"Bearer {attacker_token}"}
    resp = await async_client.get("/v1/auth/me", headers=headers)
    assert resp.status_code == 401


@pytest.mark.security
@pytest.mark.asyncio
async def test_expired_jwt_token_rejected(async_client: AsyncClient, seeded_tenant: dict):
    """Verify that expired access tokens return 401."""
    from app.config import settings

    expired_token = create_access_token(
        subject=str(seeded_tenant["admin"].id),
        org_id=str(seeded_tenant["org"].id),
        role="ORG_ADMIN",
        expires_delta=timedelta(seconds=-60),  # Expired 60s ago
        secret_key=settings.SECRET_KEY,
    )

    headers = {"Authorization": f"Bearer {expired_token}"}
    resp = await async_client.get("/v1/auth/me", headers=headers)
    assert resp.status_code == 401


@pytest.mark.security
@pytest.mark.asyncio
async def test_invalid_uuid_parameter_handling(async_client: AsyncClient, seeded_tenant: dict):
    """Verify that non-UUID path parameters return 422 Unprocessable Entity."""
    headers = {"Authorization": f"Bearer {seeded_tenant['admin_token']}"}

    malformed_paths = [
        "/v1/sessions/not-a-valid-uuid",
        "/v1/sessions/12345",
        "/v1/sessions/invalid-identifier-with-special-chars",
        "/v1/speakers/invalid-uuid-string",
    ]

    for path in malformed_paths:
        resp = await async_client.get(path, headers=headers)
        assert resp.status_code == 422, f"Expected 422 for path {path}, got {resp.status_code}"


@pytest.mark.security
@pytest.mark.asyncio
async def test_sql_injection_boundary_resilience(async_client: AsyncClient, seeded_tenant: dict):
    """Verify SQL injection payloads in JSON body fields are safely handled via parameterized ORM."""
    headers = {"Authorization": f"Bearer {seeded_tenant['admin_token']}"}

    sql_payloads = [
        "'+OR+'1'='1",
        "'; DROP TABLE users; --",
        "UNION SELECT * FROM call_sessions --",
        "admin'--",
    ]

    for payload in sql_payloads:
        create_payload = {
            "caller_ani": payload,
            "context_metadata": {"note": payload},
        }
        # Attempt session creation with SQL payload in string fields
        resp = await async_client.post("/v1/sessions", json=create_payload, headers=headers)
        # Should either create safely with escaped parameter, or return 422 validation error
        assert resp.status_code in (201, 422), f"Unexpected status {resp.status_code} on payload {payload}"
        # Ensure database didn't crash
        health_resp = await async_client.get("/health")
        assert health_resp.status_code == 200
