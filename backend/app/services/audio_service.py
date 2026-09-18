"""
TrueVoice Real-Time Audio Orchestration & Intelligence Service.
Manages circular audio buffers, two-branch pipeline execution, concurrent inference,
multi-signal risk evaluation, and real-time telemetry publishing.
"""

import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple, List
from uuid import UUID
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.audio.pipeline import AudioPipeline
from app.detectors.registry import DetectorRegistry
from app.speaker.factory import get_speaker_verifier
from app.forensics.analyzer import ForensicAnalyzer, ForensicResult
from app.asr.factory import get_speech_recognizer
from app.intelligence.intent import IntentAnalyzer
from app.intelligence.context import ContextEngine
from app.risk.engine import SessionRiskEngine
from app.policy.state_machine import ZeroTrustStateMachine
from app.core.constants import TrustState, SignalAvailability, RiskTier, SecurityActionType
from app.models.call_session import CallSession
from app.schemas.detection import DeepfakeResult
from app.schemas.speaker import VerificationResult
from app.asr.base import ASRResult
from app.schemas.risk import RiskTelemetryBroadcast
from app.services.session_service import SessionService
from app.services.speaker_service import SpeakerService
from app.services.policy_service import PolicyService
from app.services.risk_service import RiskService

logger = logging.getLogger(__name__)


class AudioService:
    """Service managing in-memory streaming pipelines across concurrent sessions."""

    _pipelines: Dict[str, AudioPipeline] = {}
    _risk_engines: Dict[str, SessionRiskEngine] = {}
    _fsm_engines: Dict[str, ZeroTrustStateMachine] = {}
    _sequence_counters: Dict[str, int] = {}

    def __init__(self):
        self.detector_registry = DetectorRegistry.get_registry()
        self.speaker_verifier = get_speaker_verifier()
        self.forensic_analyzer = ForensicAnalyzer()
        self.speech_recognizer = get_speech_recognizer()
        self.intent_analyzer = IntentAnalyzer()
        self.context_engine = ContextEngine()

    @classmethod
    def get_pipeline(cls, session_id: str) -> AudioPipeline:
        if session_id not in cls._pipelines:
            cls._pipelines[session_id] = AudioPipeline(sample_rate=16000)
        return cls._pipelines[session_id]

    @classmethod
    def get_risk_engine(cls, session_id: str) -> SessionRiskEngine:
        if session_id not in cls._risk_engines:
            cls._risk_engines[session_id] = SessionRiskEngine(session_id=session_id)
        return cls._risk_engines[session_id]

    @classmethod
    def get_fsm(cls, session_id: str, initial_state: TrustState) -> ZeroTrustStateMachine:
        if session_id not in cls._fsm_engines:
            cls._fsm_engines[session_id] = ZeroTrustStateMachine(initial_state=initial_state)
        return cls._fsm_engines[session_id]

    @classmethod
    def get_next_sequence_id(cls, session_id: str) -> int:
        seq = cls._sequence_counters.get(session_id, 0) + 1
        cls._sequence_counters[session_id] = seq
        return seq

    @classmethod
    def cleanup_session(cls, session_id: str):
        """Free in-memory audio buffers and engines when session concludes."""
        cls._pipelines.pop(session_id, None)
        cls._risk_engines.pop(session_id, None)
        cls._fsm_engines.pop(session_id, None)
        cls._sequence_counters.pop(session_id, None)

    async def process_audio_chunk(
        self,
        session: CallSession,
        raw_audio_bytes: bytes,
        source_sample_rate: int,
        db: AsyncSession
    ) -> Optional[RiskTelemetryBroadcast]:
        """
        Ingest audio chunk into circular buffer.
        If a 0.5s hop is ready and the 2.0s window is filled, execute full multi-signal evaluation.
        """
        session_id_str = str(session.id)
        pipeline = self.get_pipeline(session_id_str)
        risk_engine = self.get_risk_engine(session_id_str)

        # 1. Ingest chunk into circular buffer
        total_samples, has_speech = pipeline.process_incoming_chunk(
            raw_bytes=raw_audio_bytes,
            source_sample_rate=source_sample_rate
        )

        # Check if 2.0s window and 0.5s hop are ready
        window = pipeline.extract_analysis_window()
        if window is None:
            # Still accumulating initial window or between hops
            return None

        ml_chunk, forensic_chunk = window
        sequence_id = self.get_next_sequence_id(session_id_str)

        # Fetch enrolled speaker embedding if session claims a registered speaker
        enrolled_embedding: Optional[np.ndarray] = None
        if session.claimed_speaker_id:
            speaker_service = SpeakerService(db)
            enrolled_embedding = await speaker_service.get_speaker_embedding(session.claimed_speaker_id)

        # 2. Run multi-branch inference concurrently
        primary_detector = self.detector_registry.initialize_primary_detector()

        # Branch 1 & 2 tasks:
        # A. Deepfake detector (ML branch)
        df_task = primary_detector.predict(ml_chunk, sample_rate=16000)

        # B. Speaker verification (ML branch)
        if enrolled_embedding is not None:
            spk_task = self.speaker_verifier.verify(ml_chunk, enrolled_embedding=enrolled_embedding, sample_rate=16000)
        else:
            async def _unavail_spk():
                return VerificationResult(
                    similarity=None,
                    distance=1.0,
                    is_match=False,
                    confidence=0.0,
                    signal_availability=SignalAvailability.UNAVAILABLE,
                    model_name=getattr(self.speaker_verifier, "model_name", "speaker-verifier"),
                    model_version=getattr(self.speaker_verifier, "model_version", "v1.0"),
                )
            spk_task = _unavail_spk()

        # C. Acoustic forensics (Forensic branch - run sync CPU calculations in thread pool)
        forensics_task = asyncio.to_thread(self.forensic_analyzer.analyze, forensic_chunk, 16000)

        # D. ASR transcription (ML branch)
        asr_task = self.speech_recognizer.transcribe(ml_chunk, sample_rate=16000)

        df_res, spk_res, af_res, asr_res = await asyncio.gather(
            df_task, spk_task, forensics_task, asr_task
        )

        # 3. Intent & Context Intelligence
        s_conv, detected_intents = self.intent_analyzer.evaluate(asr_res.transcript)
        conv_avail = asr_res.signal_availability

        session_ctx = {
            "caller_ani_matches_profile": bool(session.caller_ani != "UNKNOWN"),
            "is_off_hours": False,
        }
        ctx_res = self.context_engine.evaluate(
            request_context=session.context_metadata,
            session_context=session_ctx
        )

        # 4. Multi-Signal Fusion & Asymmetric EMA Smoothing
        fusion_telemetry = risk_engine.evaluate_chunk(
            sequence_id=sequence_id,
            df_res=df_res,
            spk_res=spk_res,
            af_res=af_res,
            s_conv=s_conv,
            conv_avail=conv_avail,
            ctx_res=ctx_res,
        )

        composite_risk = fusion_telemetry["composite_risk"]
        risk_tier = RiskTier(fusion_telemetry["risk_tier"])
        primary_factors = fusion_telemetry["primary_factors"]
        provenance = fusion_telemetry["evidence_provenance"]

        # 5. Declarative Policy Evaluation & Enforcement
        policy_service = PolicyService(db)
        signal_scores = {
            "deepfake_score": df_res.score / 100.0,
            "speaker_distance": 1.0 - (spk_res.similarity if spk_res.similarity is not None else 1.0),
            "threat_score": s_conv,
            "forensic_score": af_res.score / 100.0,
        }
        policy_res = await policy_service.evaluate_and_enforce(
            session=session,
            composite_risk=composite_risk,
            signal_scores=signal_scores,
            context_features=session.context_metadata
        )

        # 6. Persist Risk Assessment Record
        risk_service = RiskService(db)
        await risk_service.record_assessment(
            session_id=session.id,
            sequence_id=sequence_id,
            synthetic_prob=df_res.score,
            speaker_similarity=spk_res.similarity,
            forensic_score=af_res.score,
            conversational_score=s_conv,
            composite_risk=composite_risk,
            risk_tier=risk_tier,
            primary_factors=primary_factors,
            evidence_provenance=provenance,
        )

        # Persist conversation analysis if speech transcript present
        if asr_res.transcript:
            await risk_service.record_conversation_analysis(
                session_id=session.id,
                sequence_id=sequence_id,
                transcript_redacted=asr_res.transcript,
                detected_intent_flags=detected_intents,
                threat_level=risk_tier.value,
                confidence=asr_res.confidence,
            )

        # 7. Assemble Real-Time Broadcast Payload
        broadcast = RiskTelemetryBroadcast(
            type="TELEMETRY",
            session_id=session_id_str,
            sequence_id=sequence_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            risk_score=composite_risk,
            risk_tier=risk_tier,
            trust_state=TrustState(session.current_trust_state),
            breakdown={
                "deepfake": df_res.score,
                "speaker_similarity": spk_res.similarity if spk_res.similarity is not None else 0.0,
                "forensic_anomaly": af_res.score,
                "conversational_threat": s_conv * 100.0,
                "context_sensitivity": ctx_res.score * 100.0,
            },
            provenance=provenance,
            security_action=policy_res.action,
            detected_intents=detected_intents,
            transcript_snippet=asr_res.transcript[:100] if asr_res.transcript else None,
        )
        return broadcast
