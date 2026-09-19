"""
Integration Tests for TrueVoice Real-Time WebSocket Audio Streaming & Telemetry.
Verifies session ticket authentication, handshake ack, frame size limits,
heartbeat ping/pong, and telemetry delivery.
"""

import json
from unittest.mock import patch, AsyncMock
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app
from app.core.security import create_websocket_token
from app.config import settings
from app.schemas.risk import RiskTelemetryBroadcast
from app.core.constants import RiskTier, TrustState, SecurityActionType


def test_websocket_unauthenticated_rejected():
    """Verify WebSocket connection without valid token or handshake is closed with 1008 policy violation."""
    client = TestClient(app)
    with client.websocket_connect("/v1/stream/00000000-0000-0000-0000-000000000001") as ws:
        # Client sends invalid handshake
        ws.send_text(json.dumps({"type": "HANDSHAKE", "token": "invalid_ticket_token"}))
        with pytest.raises(WebSocketDisconnect) as exc_info:
            ws.receive_text()
        assert exc_info.value.code == 1008


def test_websocket_oversized_frame_rejected():
    """Verify audio binary frames exceeding 64KB are rejected with 1009 MESSAGE_TOO_BIG."""
    session_id = "11111111-1111-1111-1111-111111111111"
    user_id = "22222222-2222-2222-2222-222222222222"
    org_id = "33333333-3333-3333-3333-333333333333"

    ticket = create_websocket_token(
        session_id=session_id,
        user_id=user_id,
        org_id=org_id,
        role="SECURITY_ANALYST",
        secret_key=settings.SECRET_KEY,
    )

    client = TestClient(app)

    mock_session = AsyncMock()
    mock_session.id = session_id

    with patch("app.api.websocket.audio_stream.SessionService.get_session", return_value=mock_session):
        with client.websocket_connect(f"/v1/stream/{session_id}?token={ticket}") as ws:
            ack_data = ws.receive_json()
            assert ack_data["type"] == "HANDSHAKE_ACK"
            assert ack_data["session_id"] == session_id

            # Send frame of 65537 bytes (> 64KB)
            oversized_bytes = b"\x00" * 65537
            ws.send_bytes(oversized_bytes)
            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_text()
            assert exc_info.value.code == 1009


def test_websocket_handshake_ping_pong_and_end_of_stream():
    """Verify HANDSHAKE_ACK, PING/PONG heartbeat, and clean END_OF_STREAM termination."""
    session_id = "11111111-1111-1111-1111-111111111111"
    user_id = "22222222-2222-2222-2222-222222222222"
    org_id = "33333333-3333-3333-3333-333333333333"

    ticket = create_websocket_token(
        session_id=session_id,
        user_id=user_id,
        org_id=org_id,
        role="SECURITY_ANALYST",
        secret_key=settings.SECRET_KEY,
    )

    client = TestClient(app)

    mock_session = AsyncMock()
    mock_session.id = session_id

    with patch("app.api.websocket.audio_stream.SessionService.get_session", return_value=mock_session):
        with client.websocket_connect(f"/v1/stream/{session_id}?token={ticket}") as ws:
            ack = ws.receive_json()
            assert ack["type"] == "HANDSHAKE_ACK"
            assert ack["status"] == "STREAM_INITIALIZED"
            assert ack["analysis_window_seconds"] == 2.0
            assert ack["hop_seconds"] == 0.5

            # Test PING / PONG
            ws.send_text(json.dumps({"type": "PING", "timestamp": 987654321}))
            pong = ws.receive_json()
            assert pong["type"] == "PONG"
            assert pong["timestamp"] == 987654321

            # Test END_OF_STREAM
            ws.send_text(json.dumps({"type": "END_OF_STREAM"}))


def test_websocket_audio_chunk_telemetry_broadcast():
    """Verify sending valid PCM binary frames triggers audio processing and telemetry broadcast."""
    session_id = "11111111-1111-1111-1111-111111111111"
    user_id = "22222222-2222-2222-2222-222222222222"
    org_id = "33333333-3333-3333-3333-333333333333"

    ticket = create_websocket_token(
        session_id=session_id,
        user_id=user_id,
        org_id=org_id,
        role="SECURITY_ANALYST",
        secret_key=settings.SECRET_KEY,
    )

    client = TestClient(app)

    mock_session = AsyncMock()
    mock_session.id = session_id

    sample_broadcast = RiskTelemetryBroadcast(
        type="TELEMETRY",
        session_id=session_id,
        sequence_id=1,
        timestamp="2026-09-18T12:00:00Z",
        risk_score=42.5,
        risk_tier=RiskTier.MODERATE,
        trust_state=TrustState.CAUTION,
        breakdown={
            "deepfake": 0.35,
            "speaker_similarity": 0.85,
            "forensic_anomaly": 0.20,
            "conversational_threat": 0.40,
            "context_sensitivity": 0.30,
        },
        provenance={"deepfake": {"model_name": "MockEnsemble"}},
        security_action=SecurityActionType.WARN,
        detected_intents=["URGENCY"],
        transcript_snippet="Please verify immediately.",
    )

    with patch("app.api.websocket.audio_stream.SessionService.get_session", return_value=mock_session):
        with patch("app.api.websocket.audio_stream.AudioService.process_audio_chunk", new_callable=AsyncMock, return_value=sample_broadcast):
            with client.websocket_connect(f"/v1/stream/{session_id}?token={ticket}") as ws:
                ack = ws.receive_json()
                assert ack["type"] == "HANDSHAKE_ACK"

                # Send 1600 samples of 16-bit PCM (3200 bytes = 100ms at 16kHz)
                pcm_frame = b"\x00\x00" * 1600
                ws.send_bytes(pcm_frame)

                telemetry = ws.receive_json()
                assert telemetry["type"] == "TELEMETRY"
                assert telemetry["session_id"] == session_id
                assert telemetry["risk_score"] == 42.5
                assert telemetry["risk_tier"] == "MODERATE"
                assert telemetry["security_action"] == "WARN"
                assert telemetry["breakdown"]["deepfake"] == 0.35
                assert telemetry["detected_intents"] == ["URGENCY"]
                assert telemetry["transcript_snippet"] == "Please verify immediately."
