"""
Integration Tests for TrueVoice Audio File Analysis API Endpoint.
Validates authoritative dual-file analysis (reference voice vs suspected voice),
Pydantic contracts, signal breakdown, model provenance, and error handling.
"""

import io
import numpy as np
import pytest
import soundfile as sf
from httpx import AsyncClient


def create_test_wav_bytes(duration_seconds: float = 1.0, sample_rate: int = 16000, frequency: float = 440.0) -> bytes:
    """Generate in-memory PCM16 WAV bytes with pure sine tone for testing."""
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds), endpoint=False, dtype=np.float32)
    # Sine wave audio in [-0.8, 0.8]
    audio = 0.8 * np.sin(2 * np.pi * frequency * t)
    bio = io.BytesIO()
    sf.write(bio, audio, sample_rate, format="WAV", subtype="PCM_16")
    return bio.getvalue()


@pytest.mark.asyncio
async def test_audio_analysis_success(async_client: AsyncClient, seeded_tenant: dict):
    """Verify successful dual-file audio analysis with full multi-signal evaluation."""
    headers = {"Authorization": f"Bearer {seeded_tenant['analyst_token']}"}

    ref_wav = create_test_wav_bytes(duration_seconds=1.0, frequency=300.0)
    susp_wav = create_test_wav_bytes(duration_seconds=1.5, frequency=350.0)

    files = {
        "reference_audio": ("reference_sample.wav", ref_wav, "audio/wav"),
        "suspected_audio": ("suspected_call.wav", susp_wav, "audio/wav"),
    }
    data = {
        "context_metadata": '{"transaction_amount": 75000.0, "channel": "sip_trunk"}'
    }

    response = await async_client.post("/v1/analyze/audio", files=files, data=data, headers=headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    result = response.json()
    assert result["status"] == "COMPLETED"
    assert "analysis_id" in result
    assert result["reference_audio"]["filename"] == "reference_sample.wav"
    assert result["suspected_audio"]["filename"] == "suspected_call.wav"
    assert result["reference_audio"]["sample_rate"] == 16000
    assert result["suspected_audio"]["sample_rate"] == 16000

    # Verdicts
    assert 0.0 <= result["risk_score"] <= 100.0
    assert result["risk_tier"] in ("LOW", "MODERATE", "HIGH", "CRITICAL")
    assert result["trust_state"] in ("OBSERVING", "CAUTION", "VERIFYING", "TRUSTED", "RESTRICTED", "BLOCKED", "HUMAN_REVIEW")
    assert result["security_action"] in ("ALLOW", "WARN", "REQUEST_VERIFICATION", "RESTRICT", "BLOCK", "HUMAN_REVIEW")

    # Signals
    signals = result["signals"]
    assert "deepfake" in signals
    assert 0.0 <= signals["deepfake"]["score"] <= 100.0
    assert signals["deepfake"]["label"] in ("SYNTHETIC", "AUTHENTIC")

    assert "speaker" in signals
    assert signals["speaker"]["similarity"] is not None
    assert 0.0 <= signals["speaker"]["similarity"] <= 1.0

    assert "forensics" in signals
    assert 0.0 <= signals["forensics"]["score"] <= 100.0

    assert "conversation" in signals
    assert 0.0 <= signals["conversation"]["threat_score"] <= 1.0

    assert "context" in signals
    assert 0.0 <= signals["context"]["score"] <= 1.0

    # Provenance
    assert "provenance" in result
    assert result["provenance"]["deepfake_model"]
    assert result["provenance"]["speaker_model"]
    assert result["provenance"]["asr_model"]
    assert result["provenance"]["ml_mode"]

    # Pipeline stages completed
    assert "pipeline_stages_completed" in result
    assert len(result["pipeline_stages_completed"]) >= 5
    assert result["total_processing_time_ms"] > 0.0


@pytest.mark.asyncio
async def test_audio_analysis_unauthenticated(async_client: AsyncClient):
    """Verify 401 Unauthorized when missing Bearer JWT."""
    ref_wav = create_test_wav_bytes(duration_seconds=1.0)
    susp_wav = create_test_wav_bytes(duration_seconds=1.0)

    files = {
        "reference_audio": ("ref.wav", ref_wav, "audio/wav"),
        "suspected_audio": ("susp.wav", susp_wav, "audio/wav"),
    }

    response = await async_client.post("/v1/analyze/audio", files=files)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_audio_analysis_missing_reference_audio(async_client: AsyncClient, seeded_tenant: dict):
    """Verify 422 Unprocessable Entity when reference audio is omitted."""
    headers = {"Authorization": f"Bearer {seeded_tenant['analyst_token']}"}
    susp_wav = create_test_wav_bytes(duration_seconds=1.0)

    files = {
        "suspected_audio": ("susp.wav", susp_wav, "audio/wav"),
    }

    response = await async_client.post("/v1/analyze/audio", files=files, headers=headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_audio_analysis_missing_suspected_audio(async_client: AsyncClient, seeded_tenant: dict):
    """Verify 422 Unprocessable Entity when suspected audio is omitted."""
    headers = {"Authorization": f"Bearer {seeded_tenant['analyst_token']}"}
    ref_wav = create_test_wav_bytes(duration_seconds=1.0)

    files = {
        "reference_audio": ("ref.wav", ref_wav, "audio/wav"),
    }

    response = await async_client.post("/v1/analyze/audio", files=files, headers=headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_audio_analysis_empty_file(async_client: AsyncClient, seeded_tenant: dict):
    """Verify 400 Bad Request when an empty audio file (0 bytes) is uploaded."""
    headers = {"Authorization": f"Bearer {seeded_tenant['analyst_token']}"}
    ref_wav = create_test_wav_bytes(duration_seconds=1.0)

    files = {
        "reference_audio": ("ref.wav", ref_wav, "audio/wav"),
        "suspected_audio": ("empty.wav", b"", "audio/wav"),
    }

    response = await async_client.post("/v1/analyze/audio", files=files, headers=headers)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_audio_analysis_corrupt_file(async_client: AsyncClient, seeded_tenant: dict):
    """Verify 400/415 when a corrupt non-audio file is uploaded."""
    headers = {"Authorization": f"Bearer {seeded_tenant['analyst_token']}"}
    ref_wav = create_test_wav_bytes(duration_seconds=1.0)
    corrupt_bytes = b"NOT_A_VALID_AUDIO_FILE_DATA_CORRUPT"

    files = {
        "reference_audio": ("ref.wav", ref_wav, "audio/wav"),
        "suspected_audio": ("corrupt.wav", corrupt_bytes, "audio/wav"),
    }

    response = await async_client.post("/v1/analyze/audio", files=files, headers=headers)
    assert response.status_code in (400, 415)
