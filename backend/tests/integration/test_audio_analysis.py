"""
Integration tests for POST /v1/analyze/audio endpoint.
Tests multi-branch audio processing, speaker comparison, deepfake evaluation, and declarative policy output.
"""

import io
import wave
import numpy as np
import pytest
from httpx import AsyncClient


def create_test_wav_bytes(duration_seconds: float = 1.0, freq_hz: float = 440.0, sample_rate: int = 16000) -> bytes:
    """Helper to synthesize valid in-memory PCM16 WAV audio."""
    num_samples = int(duration_seconds * sample_rate)
    t = np.linspace(0, duration_seconds, num_samples, endpoint=False)
    audio = (0.5 * np.sin(2 * np.pi * freq_hz * t) * 32767.0).astype(np.int16)

    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio.tobytes())
    return bio.getvalue()


@pytest.mark.asyncio
async def test_audio_analysis_valid_pair(async_client: AsyncClient, seeded_tenant: dict):
    """Submits valid genuine reference WAV and suspected WAV -> 200 OK and complete schema."""
    ref_wav = create_test_wav_bytes(duration_seconds=1.5, freq_hz=220.0)
    susp_wav = create_test_wav_bytes(duration_seconds=2.0, freq_hz=225.0)

    headers = {"Authorization": f"Bearer {seeded_tenant['analyst_token']}"}
    files = {
        "reference_audio": ("reference.wav", ref_wav, "audio/wav"),
        "suspected_audio": ("suspected_call.wav", susp_wav, "audio/wav"),
    }
    data = {
        "context_metadata": '{"channel": "sip_trunk", "transaction_amount": 50000.0}',
    }

    response = await async_client.post("/v1/analyze/audio", headers=headers, files=files, data=data)
    assert response.status_code == 200, response.text
    payload = response.json()

    # Validate top-level schema
    assert payload["status"] == "COMPLETED"
    assert "analysis_id" in payload
    assert 0.0 <= payload["risk_score"] <= 100.0
    assert payload["risk_tier"] in ["LOW", "MODERATE", "HIGH", "CRITICAL"]
    assert "security_action" in payload
    assert "action_reason" in payload
    assert "rule_matched" in payload

    # Validate file metadata
    assert payload["reference_audio"]["filename"] == "reference.wav"
    assert payload["reference_audio"]["duration_seconds"] >= 1.0
    assert payload["suspected_audio"]["filename"] == "suspected_call.wav"
    assert payload["suspected_audio"]["duration_seconds"] >= 1.5

    # Validate granular signal breakdown
    signals = payload["signals"]
    assert "deepfake" in signals
    assert 0.0 <= signals["deepfake"]["score"] <= 100.0
    assert signals["deepfake"]["label"] in ["SYNTHETIC", "AUTHENTIC"]

    assert "speaker" in signals
    assert signals["speaker"]["similarity"] is not None
    assert 0.0 <= signals["speaker"]["similarity"] <= 1.0

    assert "forensics" in signals
    assert 0.0 <= signals["forensics"]["score"] <= 100.0

    assert "conversation" in signals
    assert "context" in signals

    # Validate evidence & provenance
    assert len(payload["primary_factors"]) > 0
    assert "provenance" in payload
    assert len(payload["pipeline_stages_completed"]) > 0


@pytest.mark.asyncio
async def test_audio_analysis_missing_reference(async_client: AsyncClient, seeded_tenant: dict):
    """Missing reference audio yields 422 Unprocessable Entity."""
    susp_wav = create_test_wav_bytes(duration_seconds=1.0)
    headers = {"Authorization": f"Bearer {seeded_tenant['analyst_token']}"}
    files = {
        "suspected_audio": ("suspected.wav", susp_wav, "audio/wav"),
    }

    response = await async_client.post("/v1/analyze/audio", headers=headers, files=files)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_audio_analysis_empty_file(async_client: AsyncClient, seeded_tenant: dict):
    """Empty 0-byte audio yields 400 Bad Request."""
    ref_wav = create_test_wav_bytes(duration_seconds=1.0)
    headers = {"Authorization": f"Bearer {seeded_tenant['analyst_token']}"}
    files = {
        "reference_audio": ("reference.wav", ref_wav, "audio/wav"),
        "suspected_audio": ("empty.wav", b"", "audio/wav"),
    }

    response = await async_client.post("/v1/analyze/audio", headers=headers, files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_audio_analysis_unauthenticated(async_client: AsyncClient):
    """Missing bearer token yields 401 Unauthorized."""
    ref_wav = create_test_wav_bytes(duration_seconds=1.0)
    susp_wav = create_test_wav_bytes(duration_seconds=1.0)
    files = {
        "reference_audio": ("reference.wav", ref_wav, "audio/wav"),
        "suspected_audio": ("suspected.wav", susp_wav, "audio/wav"),
    }

    response = await async_client.post("/v1/analyze/audio", files=files)
    assert response.status_code == 401
