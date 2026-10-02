"""
Manual verification script for TrueVoice Audio File Analysis.
Simulates a real client uploading genuine reference voice and suspected voice recordings.
"""

import asyncio
import io
import json
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import soundfile as sf
from httpx import AsyncClient, ASGITransport

from app.main import app


def generate_audio_file(filename: str, duration: float, freq: float, modulation: bool = False) -> bytes:
    sample_rate = 16000
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False, dtype=np.float32)
    if modulation:
        # Modulated wave simulating acoustic variation
        audio = 0.7 * np.sin(2 * np.pi * freq * t + 0.3 * np.sin(2 * np.pi * 5 * t))
    else:
        audio = 0.7 * np.sin(2 * np.pi * freq * t)
    
    bio = io.BytesIO()
    sf.write(bio, audio, sample_rate, format="WAV", subtype="PCM_16")
    return bio.getvalue()


async def run_manual_test():
    print("=" * 60)
    print("TRUEVOICE REAL AUDIO FILE ANALYSIS - END-TO-END MANUAL TEST")
    print("=" * 60)

    # 1. Generate two audio samples
    ref_bytes = generate_audio_file("aditya_reference.wav", duration=1.2, freq=220.0)
    susp_bytes = generate_audio_file("suspected_call.wav", duration=1.8, freq=280.0, modulation=True)

    print(f"Generated Reference Audio: {len(ref_bytes)} bytes")
    print(f"Generated Suspected Audio: {len(susp_bytes)} bytes")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 2. Login as SOC Analyst
        login_res = await client.post("/v1/auth/login", json={
            "email": "analyst@apexfin.com",
            "password": "AnalystSecurePass123!"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        print(f"Authenticated as: {login_res.json()['role']} (User ID: {login_res.json()['user_id'][:8]})")

        # 3. Post to /v1/analyze/audio
        files = {
            "reference_audio": ("aditya_reference.wav", ref_bytes, "audio/wav"),
            "suspected_audio": ("suspected_call.wav", susp_bytes, "audio/wav"),
        }
        data = {
            "context_metadata": json.dumps({"transaction_amount": 180000.0, "caller_ani": "+919876543210"})
        }
        headers = {"Authorization": f"Bearer {token}"}

        print("\nSending POST /v1/analyze/audio ...")
        response = await client.post("/v1/analyze/audio", files=files, data=data, headers=headers)
        print(f"Response Status: {response.status_code}")
        assert response.status_code == 200, f"Analysis failed: {response.text}"

        res = response.json()
        print("\n" + "-" * 40)
        print("AUTHORITATIVE BACKEND VERDICT:")
        print("-" * 40)
        print(f"Analysis ID:        {res['analysis_id']}")
        print(f"Status:             {res['status']}")
        print(f"Reference Audio:    {res['reference_audio']['filename']} ({res['reference_audio']['duration_seconds']}s, {res['reference_audio']['format']})")
        print(f"Suspected Audio:    {res['suspected_audio']['filename']} ({res['suspected_audio']['duration_seconds']}s, {res['suspected_audio']['format']})")
        print(f"Risk Score:         {res['risk_score']} / 100.0")
        print(f"Risk Tier:          {res['risk_tier']}")
        print(f"Trust State:        {res['trust_state']}")
        print(f"Security Action:    {res['security_action']}")
        print(f"Action Reason:      {res['action_reason']}")
        print(f"Rule Matched:       {res['rule_matched']}")
        print(f"Total Latency:      {res['total_processing_time_ms']} ms")
        
        print("\nSIGNALS BREAKDOWN:")
        print(f"  • Deepfake Score:      {res['signals']['deepfake']['score']} ({res['signals']['deepfake']['label']}, Model: {res['signals']['deepfake']['model_name']})")
        print(f"  • Speaker Similarity:  {res['signals']['speaker']['similarity']} (Threshold: {res['signals']['speaker']['threshold']}, Model: {res['signals']['speaker']['model_name']})")
        print(f"  • Forensic Score:      {res['signals']['forensics']['score']} (Anomalies: {len(res['signals']['forensics']['anomalies_detected'])})")
        print(f"  • Conversation Threat: {res['signals']['conversation']['threat_score']} (Intents: {res['signals']['conversation']['detected_intents']})")
        print(f"  • Context Score:       {res['signals']['context']['score']}")

        print("\nEVIDENCE (Why this result):")
        for ev in res["evidence"]:
            print(f"  - {ev}")

        print("\nPROVENANCE:")
        print(f"  Deepfake Model: {res['provenance']['deepfake_model']} ({res['provenance']['deepfake_model_version']})")
        print(f"  Speaker Model:  {res['provenance']['speaker_model']} ({res['provenance']['speaker_model_version']})")
        print(f"  ASR Model:      {res['provenance']['asr_model']} ({res['provenance']['asr_model_version']})")
        print(f"  ML Mode:        {res['provenance']['ml_mode']}")
        print(f"  ML Device:      {res['provenance']['ml_device']}")
        print(f"  Pipeline Stages Completed: {res['pipeline_stages_completed']}")
        print("-" * 40)
        print("MANUAL VERIFICATION COMPLETED SUCCESSFULLY.")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_manual_test())
