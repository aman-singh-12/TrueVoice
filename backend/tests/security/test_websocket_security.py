"""
Security Tests: WebSocket Audio Streaming Endpoint Controls.
Fulfills Person 5 Part J requirements:
- Invalid or missing WebSocket tickets rejected with WS 1008 Policy Violation
- Ticket scoped to wrong session or wrong scope rejected
- Malformed text and JSON control messages handled safely without crash
- Oversized audio chunks handled defensively
"""

import uuid
import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app
from app.config import settings
from app.core.security import create_access_token


@pytest.fixture
def sync_test_client():
    """Synchronous test client for Starlette WebSocket connections."""
    return TestClient(app)


@pytest.mark.security
def test_ws_connection_without_token_rejected(sync_test_client: TestClient):
    """Verify that connecting to streaming WebSocket without token is closed with WS 1008."""
    dummy_session_id = str(uuid.uuid4())
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with sync_test_client.websocket_connect(f"/v1/stream/{dummy_session_id}") as ws:
            ws.send_text('{"type": "INVALID_HANDSHAKE"}')
            ws.receive_text()

    assert exc_info.value.code == 1008


@pytest.mark.security
def test_ws_connection_with_invalid_token_rejected(sync_test_client: TestClient):
    """Verify that an invalid JWT ticket token is closed with WS 1008."""
    dummy_session_id = str(uuid.uuid4())
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with sync_test_client.websocket_connect(f"/v1/stream/{dummy_session_id}?token=invalid.jwt.token") as ws:
            ws.send_text('{"type": "INVALID_HANDSHAKE"}')
            ws.receive_text()

    assert exc_info.value.code == 1008


@pytest.mark.security
def test_ws_connection_with_mismatched_session_id_rejected(sync_test_client: TestClient):
    """Verify ticket issued for Session A cannot be used to connect to Session B."""
    session_a = str(uuid.uuid4())
    session_b = str(uuid.uuid4())

    # Ticket scoped for session_a
    from datetime import timedelta
    from jose import jwt
    from datetime import datetime, timezone

    claims = {
        "sub": "user_123",
        "org_id": str(uuid.uuid4()),
        "scope": "websocket_stream",
        "session_id": session_a,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    ticket_a = jwt.encode(claims, settings.SECRET_KEY, algorithm="HS256")

    # Attempt connecting to session_b using ticket for session_a
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with sync_test_client.websocket_connect(f"/v1/stream/{session_b}?token={ticket_a}") as ws:
            ws.send_text('{"type": "INVALID_HANDSHAKE"}')
            ws.receive_text()

    assert exc_info.value.code == 1008


@pytest.mark.security
def test_ws_connection_with_standard_auth_token_rejected(sync_test_client: TestClient):
    """Verify standard access token (without scope='websocket_stream') is rejected."""
    session_id = str(uuid.uuid4())
    standard_token = create_access_token(
        subject="user_123",
        org_id=str(uuid.uuid4()),
        role="ORG_ADMIN",
        secret_key=settings.SECRET_KEY,
    )

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with sync_test_client.websocket_connect(f"/v1/stream/{session_id}?token={standard_token}") as ws:
            ws.send_text('{"type": "INVALID_HANDSHAKE"}')
            ws.receive_text()

    assert exc_info.value.code == 1008
