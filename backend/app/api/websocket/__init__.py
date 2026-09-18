"""
WebSocket routes.
"""
from app.api.websocket.audio_stream import router as websocket_router

__all__ = ["websocket_router"]
