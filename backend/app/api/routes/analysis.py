"""
TrueVoice Audio File Analysis API Endpoint.
Provides authoritative dual-file analysis (Reference Voice vs Suspected Voice)
executing all 5 intelligence branches, multi-signal risk fusion, and declarative policy evaluation.
"""

import asyncio
import io
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple
import numpy as np
import soundfile as sf
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.constants import (
    RiskTier,
    Role,
    SecurityActionType,
    SignalAvailability,
    TrustState,
)
from app.core.exceptions import AudioProcessingError
from app.dependencies import AuthenticatedUser, get_current_user, get_db
from app.audio.decoder import decode_pcm16_le, decode_wav_bytes
from app.audio.resampler import AudioResampler
from app.detectors.registry import DetectorRegistry
from app.speaker.factory import get_speaker_verifier
from app.forensics.analyzer import ForensicAnalyzer
from app.asr.factory import get_speech_recognizer
from app.intelligence.intent import IntentAnalyzer
from app.intelligence.context import ContextEngine
from app.risk.fusion import MultiSignalRiskFusion, classify_risk_tier
from app.policy.engine import DeclarativePolicyEngine
from app.services.policy_service import PolicyService
from app.schemas.analysis import (
    AudioAnalysisResponse,
    AudioFileMetadata,
    AnalysisSignals,
    DeepfakeSignalDetail,
    SpeakerSignalDetail,
    ForensicsSignalDetail,
    ConversationSignalDetail,
    ContextSignalDetail,
    AnalysisModelProvenance,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/analyze", tags=["Audio Analysis"])

resampler = AudioResampler(target_sample_rate=16000)

MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024  # 30 MB max per audio file


def load_and_resample_audio(file_bytes: bytes, filename: str) -> Tuple[np.ndarray, AudioFileMetadata]:
    """
    Decodes uploaded audio bytes (WAV, FLAC, OGG, PCM, etc.) and normalizes to 16,000 Hz Mono float32 [-1.0, 1.0].
    """
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Uploaded audio file '{filename}' is empty (0 bytes).",
        )

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio file '{filename}' exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.",
        )

    audio_data: Optional[np.ndarray] = None
    orig_sr: int = 16000
    channels: int = 1
    detected_format: str = "WAV"

    # Attempt 1: SoundFile (handles standard WAV, FLAC, OGG)
    try:
        with io.BytesIO(file_bytes) as bio:
            data, sr = sf.read(bio, dtype="float32")
            orig_sr = sr
            if data.ndim == 1:
                audio_data = data
                channels = 1
            else:
                channels = data.shape[1]
                audio_data = data.mean(axis=1)
            detected_format = "SOUNDFILE_DECODED"
    except Exception as sf_err:
        logger.debug(f"SoundFile decode attempt for '{filename}' encountered notice: {sf_err}")
        # Attempt 2: Standard WAV RIFF decoder
        if file_bytes.startswith(b"RIFF"):
            try:
                audio_data, orig_sr = decode_wav_bytes(file_bytes)
                detected_format = "RIFF_WAV"
            except Exception as wav_err:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unable to parse WAV format for '{filename}': {str(wav_err)}",
                )
        elif len(file_bytes) % 2 == 0:
            # Attempt 3: Raw PCM16 Little-Endian
            try:
                audio_data = decode_pcm16_le(file_bytes)
                orig_sr = 16000
                detected_format = "RAW_PCM16"
            except Exception as pcm_err:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unable to decode PCM audio for '{filename}': {str(pcm_err)}",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported audio format for '{filename}'. Please provide a standard WAV, FLAC, or OGG recording.",
            )

    if audio_data is None or len(audio_data) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Decoded audio data from '{filename}' contains no audible frames.",
        )

    # Minimum duration check: 0.25 seconds
    duration_orig = len(audio_data) / float(orig_sr)
    if duration_orig < 0.25:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Audio file '{filename}' duration ({duration_orig:.2f}s) is below minimum required 0.25 seconds.",
        )

    # Resample to canonical 16,000 Hz Mono
    try:
        canonical_audio = resampler.resample(audio_data, source_sample_rate=orig_sr)
    except AudioProcessingError as ape:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ape))

    final_duration = len(canonical_audio) / 16000.0

    metadata = AudioFileMetadata(
        filename=filename,
        size_bytes=len(file_bytes),
        duration_seconds=round(final_duration, 2),
        sample_rate=16000,
        channels=1,
        format=detected_format,
    )

    return canonical_audio, metadata


@router.post("/audio", response_model=AudioAnalysisResponse)
async def analyze_audio_pair(
    reference_audio: UploadFile = File(..., description="Original/Reference genuine voice sample"),
    suspected_audio: UploadFile = File(..., description="Suspected voice recording to analyze"),
    context_metadata: Optional[str] = Form(None, description="Optional JSON string of transaction/channel context"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Perform authoritative batch voice analysis on a reference voice sample and suspected audio.
    Executes:
    1. Polyphase Resampling & Canonicalization
    2. Deepfake Artifact Detection (Wav2Vec2 / Resident Detector)
    3. Speaker Verification (ECAPA-TDNN Cross-Embedding Comparison)
    4. DSP Acoustic Forensics (F0, Jitter, Shimmer, HNR, Spectral Flux)
    5. Faster-Whisper ASR Speech Recognition
    6. Conversational Threat & Intent Analysis
    7. Multi-Signal Security Risk Fusion
    8. Declarative Policy Evaluation
    """
    start_time = time.perf_counter()
    pipeline_stages: list[str] = ["upload_received"]

    # 1. Read File Contents
    try:
        ref_bytes = await reference_audio.read()
        susp_bytes = await suspected_audio.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed reading uploaded audio files: {str(exc)}",
        )

    pipeline_stages.append("audio_preprocessing")
    ref_16k, ref_meta = load_and_resample_audio(ref_bytes, reference_audio.filename or "reference.wav")
    susp_16k, susp_meta = load_and_resample_audio(susp_bytes, suspected_audio.filename or "suspected.wav")

    # 2. Parse Context Metadata if provided
    parsed_context = {}
    if context_metadata:
        try:
            parsed_context = json.loads(context_metadata)
        except Exception:
            parsed_context = {"raw_context": context_metadata}

    # 3. Instantiate Engines & Detectors
    settings = get_settings()
    detector_registry = DetectorRegistry.get_registry()
    primary_detector = detector_registry.initialize_primary_detector()
    speaker_verifier = get_speaker_verifier()
    forensic_analyzer = ForensicAnalyzer()
    speech_recognizer = get_speech_recognizer()
    intent_analyzer = IntentAnalyzer()
    context_engine = ContextEngine()
    fusion_engine = MultiSignalRiskFusion()

    # 4. Execute Multi-Branch Concurrent Inference
    # A. Speaker Verification (Extract Reference Embedding -> Compare with Suspected)
    pipeline_stages.append("speaker_verification")
    ref_emb = await speaker_verifier.enroll([ref_16k], sample_rate=16000)
    spk_task = speaker_verifier.verify(susp_16k, enrolled_embedding=ref_emb, sample_rate=16000)

    # B. Deepfake Detection on Suspected Audio
    pipeline_stages.append("deepfake_detection")
    df_task = primary_detector.predict(susp_16k, sample_rate=16000)

    # C. Acoustic Forensics (CPU DSP)
    pipeline_stages.append("acoustic_forensics")
    forensics_task = asyncio.to_thread(forensic_analyzer.analyze, susp_16k, 16000)

    # D. ASR Speech Transcription
    pipeline_stages.append("asr_transcription")
    asr_task = speech_recognizer.transcribe(susp_16k, sample_rate=16000)

    # Run tasks concurrently
    df_res, spk_res, af_res, asr_res = await asyncio.gather(
        df_task, spk_task, forensics_task, asr_task
    )

    # 5. Conversation & Intent Analysis
    pipeline_stages.append("conversational_intent")
    s_conv, detected_intents = intent_analyzer.evaluate(asr_res.transcript)
    conv_avail = asr_res.signal_availability

    # 6. Context Analysis
    ctx_res = context_engine.evaluate(
        request_context=parsed_context,
        session_context={"caller_ani_matches_profile": True, "is_off_hours": False},
    )
    ctx_avail = SignalAvailability.AVAILABLE if getattr(ctx_res, "available", True) else SignalAvailability.UNAVAILABLE

    # 7. Multi-Signal Risk Fusion
    pipeline_stages.append("multi_signal_risk_fusion")
    r_raw, normalized_weights, has_compounding = fusion_engine.fuse(
        s_df=df_res.score,
        df_avail=df_res.signal_availability,
        s_speaker=spk_res.similarity if spk_res.signal_availability == SignalAvailability.AVAILABLE else None,
        spk_avail=spk_res.signal_availability,
        s_conv=s_conv,
        conv_avail=conv_avail,
        s_context=ctx_res.score,
        ctx_avail=ctx_avail,
        s_forensic=af_res.score,
        for_avail=af_res.signal_availability,
    )

    composite_risk = float(np.clip(r_raw, 0.0, 100.0))
    risk_tier = classify_risk_tier(composite_risk)

    # 8. Declarative Policy Evaluation
    pipeline_stages.append("policy_evaluation")
    policy_service = PolicyService(db)
    active_policy = await policy_service.get_active_policy(current_user.org_id)
    policy_rules = {
        "caution_threshold": active_policy.caution_threshold if active_policy else settings.risk_moderate_threshold,
        "verify_threshold": active_policy.verify_threshold if active_policy else settings.risk_high_threshold,
        "block_threshold": active_policy.block_threshold if active_policy else settings.risk_critical_threshold,
        "high_value_threshold": active_policy.sensitive_amount_threshold if active_policy else settings.SENSITIVE_AMOUNT_THRESHOLD,
        "enforce_transaction_lock": active_policy.enforce_transaction_lock if active_policy else True,
    }
    policy_engine = DeclarativePolicyEngine(tenant_policy=policy_rules)

    signal_scores = {
        "deepfake_score": df_res.score / 100.0,
        "speaker_distance": 1.0 - (spk_res.similarity if spk_res.similarity is not None else 1.0),
        "threat_score": s_conv,
        "forensic_score": af_res.score / 100.0,
    }

    # Extract contributing evidence strictly from real backend analysis
    primary_factors: list[str] = []
    if df_res.signal_availability == SignalAvailability.AVAILABLE:
        if df_res.score >= 50.0:
            primary_factors.append(f"Synthetic voice artifacts detected (Deepfake Score: {df_res.score:.1f}/100)")
        else:
            primary_factors.append(f"Acoustic spectral patterns indicate genuine voice (Synthetic score: {df_res.score:.1f}/100)")

    if spk_res.signal_availability == SignalAvailability.AVAILABLE:
        if spk_res.similarity is not None:
            if spk_res.similarity < spk_res.threshold:
                primary_factors.append(
                    f"Biometric voiceprint divergence: Similarity of {spk_res.similarity:.2f} is below verification threshold {spk_res.threshold:.2f}"
                )
            else:
                primary_factors.append(
                    f"Biometric voiceprint match: Similarity of {spk_res.similarity:.2f} satisfies verification threshold {spk_res.threshold:.2f}"
                )

    if af_res.signal_availability == SignalAvailability.AVAILABLE:
        if af_res.score >= 35.0:
            primary_factors.append(f"Acoustic DSP anomalies present (Score: {af_res.score:.1f}/100)")
            for ev in getattr(af_res, "evidence", [])[:2]:
                if ev not in primary_factors:
                    primary_factors.append(f"Forensic indicator: {ev}")

    if conv_avail == SignalAvailability.AVAILABLE and s_conv >= 0.25:
        primary_factors.append(f"Social-engineering urgency / authority intent detected in speech transcript ({s_conv:.2f})")
        for flag in detected_intents:
            primary_factors.append(f"Detected conversational intent: {flag}")

    if has_compounding:
        primary_factors.append("Multi-vector compounding risk escalation applied (dual correlated threat signals)")

    policy_res = policy_engine.evaluate(
        composite_risk=composite_risk,
        current_state=TrustState.OBSERVING,
        signal_scores=signal_scores,
        context_features=parsed_context,
        signal_availability={
            "deepfake": df_res.signal_availability == SignalAvailability.AVAILABLE,
            "speaker": spk_res.signal_availability == SignalAvailability.AVAILABLE,
            "forensics": af_res.signal_availability == SignalAvailability.AVAILABLE,
            "conversation": conv_avail == SignalAvailability.AVAILABLE,
            "context": ctx_avail == SignalAvailability.AVAILABLE,
        },
        contributing_factors=primary_factors,
    )

    pipeline_stages.append("final_result_ready")
    total_time_ms = (time.perf_counter() - start_time) * 1000.0

    # 9. Construct Response
    return AudioAnalysisResponse(
        analysis_id=str(uuid.uuid4()),
        status="COMPLETED",
        created_at=datetime.now(timezone.utc),
        reference_audio=ref_meta,
        suspected_audio=susp_meta,
        risk_score=round(composite_risk, 1),
        risk_tier=risk_tier,
        trust_state=policy_res.target_trust_state or TrustState.OBSERVING,
        security_action=policy_res.action,
        action_reason=policy_res.reason,
        rule_matched=policy_res.rule_matched,
        primary_factors=primary_factors,
        evidence=primary_factors,
        signals=AnalysisSignals(
            deepfake=DeepfakeSignalDetail(
                score=round(df_res.score, 1),
                label=df_res.label,
                confidence=round(df_res.confidence, 2) if df_res.confidence is not None else None,
                signal_availability=df_res.signal_availability,
                model_name=df_res.model_name,
                model_version=df_res.model_version,
                inference_time_ms=round(df_res.inference_time_ms, 1),
            ),
            speaker=SpeakerSignalDetail(
                similarity=round(spk_res.similarity, 3) if spk_res.similarity is not None else None,
                threshold=spk_res.threshold,
                is_match=spk_res.is_match,
                confidence=round(spk_res.confidence, 2) if spk_res.confidence is not None else None,
                signal_availability=spk_res.signal_availability,
                model_name=spk_res.model_name,
                model_version=spk_res.model_version,
                inference_time_ms=round(spk_res.inference_time_ms, 1),
            ),
            forensics=ForensicsSignalDetail(
                score=round(af_res.score, 1),
                signal_availability=af_res.signal_availability,
                f0_mean=round(af_res.features.get("mean_f0_hz"), 1) if af_res.features.get("mean_f0_hz") is not None else None,
                f0_std=round(af_res.features.get("max_pitch_jump_hz"), 1) if af_res.features.get("max_pitch_jump_hz") is not None else None,
                jitter_local=round(af_res.features.get("jitter_local"), 4) if af_res.features.get("jitter_local") is not None else None,
                shimmer_local=round(af_res.features.get("shimmer_local"), 4) if af_res.features.get("shimmer_local") is not None else None,
                hnr_db=round(af_res.features.get("hnr_db"), 1) if af_res.features.get("hnr_db") is not None else None,
                spectral_centroid_mean=round(af_res.features.get("spectral_centroid_hz"), 1) if af_res.features.get("spectral_centroid_hz") is not None else None,
                spectral_rolloff_mean=round(af_res.features.get("spectral_rolloff_hz"), 1) if af_res.features.get("spectral_rolloff_hz") is not None else None,
                spectral_flux_mean=round(af_res.features.get("spectral_flux"), 4) if af_res.features.get("spectral_flux") is not None else None,
                rms_energy_mean=round(af_res.features.get("rms_energy"), 4) if af_res.features.get("rms_energy") is not None else None,
                anomalies_detected=getattr(af_res, "evidence", []),
                evidence=getattr(af_res, "evidence", []),
                model_name="dsp-forensic-analyzer",
                model_version="v1.2.0",
            ),
            conversation=ConversationSignalDetail(
                threat_score=round(s_conv, 2),
                detected_intents=detected_intents,
                transcript=asr_res.transcript,
                language=asr_res.language,
                confidence=round(asr_res.confidence, 2) if asr_res.confidence is not None else None,
                signal_availability=conv_avail,
                model_name=asr_res.model_name,
                model_version=asr_res.model_version,
            ),
            context=ContextSignalDetail(
                score=round(ctx_res.score, 2),
                signal_availability=ctx_avail,
                risk_factors=ctx_res.risk_factors,
                features=ctx_res.features,
            ),
        ),
        provenance=AnalysisModelProvenance(
            deepfake_model=df_res.model_name,
            deepfake_model_version=df_res.model_version,
            speaker_model=spk_res.model_name,
            speaker_model_version=spk_res.model_version,
            asr_model=asr_res.model_name,
            asr_model_version=asr_res.model_version,
            ml_mode=settings.TRUEVOICE_ML_MODE,
            ml_device=settings.TRUEVOICE_ML_DEVICE,
        ),
        pipeline_stages_completed=pipeline_stages,
        total_processing_time_ms=round(total_time_ms, 1),
    )
