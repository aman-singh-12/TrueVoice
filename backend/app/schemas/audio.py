"""
Pydantic Schemas for Audio Streaming, Handshake, and Validation.
"""

from typing import Optional
from pydantic import BaseModel, Field


class AudioHandshake(BaseModel):
    """Client initial handshake message over WebSocket."""
    type: str = "HANDSHAKE"
    sample_rate: int = Field(44100, description="Native client capture rate (e.g. 44100, 48000, 16000)")
    channels: int = Field(1, description="Number of audio channels (1=mono)")
    claimed_speaker_id: Optional[str] = None


class AudioEventMessage(BaseModel):
    """Client event message (e.g. sensitive action attempted)."""
    type: str = "EVENT"
    event_name: str
    amount: Optional[float] = None
    is_new_beneficiary: Optional[bool] = False
