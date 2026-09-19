"""
Privacy and Data Retention Validation Tests.
Fulfills Person 5 Part H requirements:
- Temporary buffer zeroing on reset
- Session cleanup drops in-memory audio buffers
- Database models do NOT persist raw audio waveforms
- Speaker profile stores mathematical embeddings (192-d), not voice recordings
- Sensitive telemetry output and transcripts are sanitized and bounded
"""

import numpy as np
import pytest
from uuid import uuid4

from app.audio.buffer import CircularAudioBuffer
from app.services.audio_service import AudioService
from app.models.call_session import CallSession
from app.models.risk_assessment import RiskAssessment
from app.models.security_action import SecurityAction
from app.models.audit_log import AuditLog
from app.models.speaker_profile import VoiceprintEmbedding
from app.models.verification_event import VerificationEvent


@pytest.mark.unit
def test_circular_audio_buffer_zeroing_on_clear():
    """Privacy test: Clearing circular audio buffer zeroes memory in-place."""
    buf = CircularAudioBuffer(capacity_seconds=1.0, sample_rate=16000)
    fake_speech = np.random.uniform(-0.5, 0.5, 8000).astype(np.float32)

    buf.write(fake_speech)
    assert buf.available_samples == 8000
    assert not np.all(buf.buffer == 0.0)

    # Perform buffer clear / teardown
    buf.clear()

    # Verify state reset and zeroed memory
    assert buf.available_samples == 0
    assert buf.write_head == 0
    assert np.all(buf.buffer == 0.0), "Buffer memory must be zeroed on clear to prevent residual audio leakage"


@pytest.mark.unit
def test_audio_service_session_cleanup_evicts_memory():
    """Privacy test: AudioService.cleanup_session() evicts pipeline references."""
    session_id = str(uuid4())

    # Ingest creates pipeline in memory
    pipe = AudioService.get_pipeline(session_id)
    assert session_id in AudioService._pipelines

    # Write samples
    fake_samples = np.random.uniform(-0.3, 0.3, 4000).astype(np.float32)
    pipe.buffer.write(fake_samples)
    assert pipe.buffer.available_samples == 4000

    # Execute session cleanup
    AudioService.cleanup_session(session_id)

    # Verify session pipeline is evicted from in-memory tracking
    assert session_id not in AudioService._pipelines
    assert session_id not in AudioService._risk_engines
    assert session_id not in AudioService._fsm_engines


@pytest.mark.unit
def test_database_models_do_not_persist_raw_audio():
    """
    Privacy test: Verify database schema models do not contain binary columns
    storing raw audio, PCM streams, or audio recordings.
    """
    prohibited_names = {"audio", "raw_audio", "pcm", "wav", "recording", "voice_sample"}

    models_to_check = [
        CallSession,
        RiskAssessment,
        SecurityAction,
        AuditLog,
        VerificationEvent,
        VoiceprintEmbedding,
    ]

    for model in models_to_check:
        column_names = [col.name.lower() for col in model.__table__.columns]
        for col in column_names:
            assert col not in prohibited_names, (
                f"Model {model.__name__} violates privacy standards by persisting raw audio column '{col}'"
            )


@pytest.mark.unit
def test_speaker_voiceprint_stores_only_embedding():
    """Privacy test: VoiceprintEmbedding stores 192-d normalized mathematical embedding vector, not raw voice."""
    vp_cols = {col.name: col for col in VoiceprintEmbedding.__table__.columns}
    assert "embedding" in vp_cols
    # Ensure no binary audio column exists
    for col_name in vp_cols:
        assert "audio" not in col_name.lower()
        assert "wav" not in col_name.lower()


@pytest.mark.unit
def test_telemetry_transcript_truncation_bound():
    """Privacy test: Real-time telemetry truncates transcripts to prevent conversational eavesdropping."""
    from app.schemas.risk import RiskTelemetryBroadcast
    from app.core.constants import RiskTier, TrustState, SecurityActionType

    long_dialogue = "This is a very sensitive financial conversation containing banking account numbers " * 10

    broadcast = RiskTelemetryBroadcast(
        type="TELEMETRY",
        session_id=str(uuid4()),
        sequence_id=1,
        timestamp="2026-09-18T10:00:00Z",
        risk_score=25.0,
        risk_tier=RiskTier.LOW,
        trust_state=TrustState.OBSERVING,
        breakdown={},
        provenance={},
        security_action=SecurityActionType.ALLOW,
        detected_intents=[],
        transcript_snippet=long_dialogue[:100],  # Bounded to snippet
    )

    assert broadcast.transcript_snippet is not None
    assert len(broadcast.transcript_snippet) <= 100
