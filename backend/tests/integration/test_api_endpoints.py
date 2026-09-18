"""
Integration Tests for TrueVoice API Endpoints.
Uses SQLite in-memory and HTTPX async client.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(async_client: AsyncClient):
    """Verify health check endpoint returns 200 and operational diagnostics."""
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ONLINE", "DEGRADED")
    assert "primary_detector" in data


@pytest.mark.asyncio
async def test_auth_login_and_me(async_client: AsyncClient, seeded_tenant: dict):
    """Verify login authentication and identity claims."""
    login_payload = {
        "email": "admin@apexfin.com",
        "password": "AdminSecurePass123!",
    }
    response = await async_client.post("/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    token_data = response.json()
    assert "access_token" in token_data
    assert token_data["role"] == "ORG_ADMIN"

    # Profile query
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    me_resp = await async_client.get("/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "admin@apexfin.com"


@pytest.mark.asyncio
async def test_session_lifecycle(async_client: AsyncClient, seeded_tenant: dict):
    """Verify session creation, lookup, ticket token generation, and termination."""
    headers = {"Authorization": f"Bearer {seeded_tenant['admin_token']}"}

    # 1. Create session
    create_payload = {
        "caller_ani": "+919876543210",
        "context_metadata": {"transaction_amount": 15000.0},
    }
    create_resp = await async_client.post("/v1/sessions", json=create_payload, headers=headers)
    assert create_resp.status_code == 201
    sess_data = create_resp.json()
    session_id = sess_data["id"]
    assert sess_data["current_trust_state"] == "OBSERVING"

    # 2. Get session details
    get_resp = await async_client.get(f"/v1/sessions/{session_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["caller_ani"] == "+919876543210"

    # 3. Create short-lived WebSocket session ticket token
    ticket_resp = await async_client.post(
        "/v1/auth/session-token",
        json={"session_id": session_id},
        headers=headers,
    )
    assert ticket_resp.status_code == 200
    assert "ticket_token" in ticket_resp.json()

    # 4. Terminate session
    term_resp = await async_client.post(f"/v1/sessions/{session_id}/terminate", headers=headers)
    assert term_resp.status_code == 200
    assert term_resp.json()["current_trust_state"] == "TERMINATED"


@pytest.mark.asyncio
async def test_policy_management(async_client: AsyncClient, seeded_tenant: dict):
    """Verify policy creation and retrieval."""
    headers = {"Authorization": f"Bearer {seeded_tenant['admin_token']}"}

    policy_payload = {
        "policy_name": "Apex Enterprise Fraud Rules",
        "caution_threshold": 35.0,
        "verify_threshold": 65.0,
        "block_threshold": 85.0,
        "enforce_transaction_lock": True,
        "sensitive_amount_threshold": 500000.0,
        "oob_timeout_seconds": 30,
        "version": "1.0.0",
    }
    create_resp = await async_client.post("/v1/policies", json=policy_payload, headers=headers)
    assert create_resp.status_code == 201
    assert create_resp.json()["policy_name"] == "Apex Enterprise Fraud Rules"

    get_resp = await async_client.get("/v1/policies", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["caution_threshold"] == 35.0


@pytest.mark.asyncio
async def test_secondary_verification_and_audit_ledger(async_client: AsyncClient, seeded_tenant: dict):
    """Verify challenge dispatch, proof verification, and audit chain cryptographic integrity."""
    headers = {"Authorization": f"Bearer {seeded_tenant['analyst_token']}"}

    # Create session
    create_resp = await async_client.post(
        "/v1/sessions",
        json={"caller_ani": "+919999999999", "context_metadata": {}},
        headers=headers,
    )
    session_id = create_resp.json()["id"]

    # Dispatch challenge
    dispatch_resp = await async_client.post(
        "/v1/verification/dispatch",
        json={"session_id": session_id, "challenge_type": "OOB_PUSH"},
        headers=headers,
    )
    assert dispatch_resp.status_code == 201
    dispatch_data = dispatch_resp.json()
    challenge_token = dispatch_data["challenge_token"]
    nonce = dispatch_data["nonce"]

    # Verify challenge
    verify_resp = await async_client.post(
        f"/v1/verification/verify?session_id={session_id}",
        json={"challenge_token": challenge_token, "nonce": nonce, "signature": nonce},
        headers=headers,
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["status"] == "SUCCESS"

    # Query audit logs
    audit_resp = await async_client.get(f"/v1/audit/{session_id}/logs", headers=headers)
    assert audit_resp.status_code == 200
    logs = audit_resp.json()
    assert len(logs) >= 3  # SESSION_CREATED, STATE_TRANSITION, VERIFICATION_DISPATCHED, etc.

    # Validate tamper-evident SHA-256 hash chain
    chain_val_resp = await async_client.get(f"/v1/audit/{session_id}/verify-chain", headers=headers)
    assert chain_val_resp.status_code == 200
    chain_res = chain_val_resp.json()
    assert chain_res["is_valid"] is True
    assert chain_res["total_events"] == len(logs)
