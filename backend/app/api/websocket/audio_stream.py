"""
TrueVoice Real-Time Audio Streaming WebSocket Endpoint.
Ingests live voice PCM chunks, enforces session-scoped ticket auth,
executes the two-branch ML/forensics pipeline, and broadcasts telemetry frames.
"""

import json
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
import logging

from app.config import get_settings
from app.core.security import decode_token
from app.core.constants import TrustState
from app.db.session import async_session_factory
from app.services.session_service import SessionService
from app.services.audio_service import AudioService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Audio Streaming"])


@router.websocket("/v1/stream/{session_id}")
async def websocket_audio_stream(
    websocket: WebSocket,
    session_id: str,
    token: Optional[str] = Query(None)
):
    """
    Real-time bidirectional WebSocket stream for audio chunk ingestion and telemetry delivery.
    Requires short-lived session ticket token via query parameter or initial HANDSHAKE.
    """
    await websocket.accept()
    settings = get_settings()
    audio_service = AudioService()

    # 1. Ticket Token Validation
    authenticated = False
    org_id = None
    user_id = None

    if token:
        try:
            claims = decode_token(token, settings.secret_key)
            if claims.get("scope") == "websocket_stream" and claims.get("session_id") == session_id:
                authenticated = True
                org_id = claims.get("org_id")
                user_id = claims.get("sub")
        except Exception as ex:
            logger.warning(f"Invalid WS token: {ex}")

    # If not authenticated via query parameter, wait for HANDSHAKE message
    source_sample_rate = 16000

    if not authenticated:
        try:
            initial_msg = await websocket.receive_text()
            data = json.loads(initial_msg)
            if data.get("type") == "HANDSHAKE":
                ticket = data.get("token")
                if ticket:
                    claims = decode_token(ticket, settings.secret_key)
                    if claims.get("scope") == "websocket_stream" and claims.get("session_id") == session_id:
                        authenticated = True
                        org_id = claims.get("org_id")
                        user_id = claims.get("sub")
                        source_sample_rate = data.get("sample_rate", 16000)
        except Exception as ex:
            logger.warning(f"Handshake failed: {ex}")

    if not authenticated:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or missing session ticket token")
        return

    # Validate session exists in database
    async with async_session_factory() as db:
        session_service = SessionService(db)
        try:
            session = await session_service.get_session(UUID(session_id), UUID(org_id) if org_id else None)
        except Exception as ex:
            logger.error(f"Could not resolve session {session_id}: {ex}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Session not found or access denied")
            return

    # Send handshake acknowledgement
    await websocket.send_text(json.dumps({
        "type": "HANDSHAKE_ACK",
        "session_id": session_id,
        "status": "STREAM_INITIALIZED",
        "source_sample_rate": source_sample_rate,
        "analysis_window_seconds": settings.window_seconds,
        "hop_seconds": settings.hop_seconds,
    }))

    logger.info(f"WebSocket client connected for session {session_id}")

    try:
        while True:
            message = await websocket.receive()

            if "bytes" in message and message["bytes"]:
                raw_chunk = message["bytes"]
                if len(raw_chunk) > 65536:
                    logger.warning(f"Rejecting oversized audio frame ({len(raw_chunk)} bytes) for session {session_id}")
                    await websocket.close(code=status.WS_1009_MESSAGE_TOO_BIG, reason="Audio frame exceeds 64KB limit")
                    return
                
                # Ingest chunk & evaluate if hop is ready
                async with async_session_factory() as db:
                    session_service = SessionService(db)
                    current_session = await session_service.get_session(UUID(session_id))
                    
                    broadcast = await audio_service.process_audio_chunk(
                        session=current_session,
                        raw_audio_bytes=raw_chunk,
                        source_sample_rate=source_sample_rate,
                        db=db
                    )

                    if broadcast is not None:
                        # Stream telemetry frame to client
                        await websocket.send_text(broadcast.model_dump_json())

            elif "text" in message and message["text"]:
                try:
                    payload = json.loads(message["text"])
                    msg_type = payload.get("type", "").upper()
                    if msg_type == "PING":
                        await websocket.send_text(json.dumps({"type": "PONG", "timestamp": payload.get("timestamp")}))
                    elif msg_type == "END_OF_STREAM":
                        logger.info(f"Client requested end of stream for session {session_id}")
                        break
                except json.JSONDecodeError:
                    pass

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as ex:
        logger.error(f"Error in audio streaming loop for session {session_id}: {ex}", exc_info=True)
    finally:
        audio_service.cleanup_session(session_id)
