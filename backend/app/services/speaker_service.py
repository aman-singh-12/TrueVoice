"""
TrueVoice Speaker Enrollment and Biometrics Service.
Handles profile lifecycle, audio sample processing, 192-d voiceprint extraction,
and tenant-scoped biometrics management.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import logging

from app.config import get_settings
from app.models.speaker_profile import SpeakerProfile, VoiceprintEmbedding
from app.schemas.speaker import (
    SpeakerEnrollRequest,
    SpeakerProfileResponse,
    VoiceprintResponse,
    VerificationResult,
    SpeakerVerificationResult,
)
from app.core.constants import SignalAvailability
from app.core.exceptions import (
    ResourceNotFoundError,
    TenantAccessViolation,
    AudioProcessingError,
    ModelUnavailableError,
)
from app.audio.decoder import AudioDecoder
from app.audio.resampler import AudioResampler
from app.speaker.factory import get_speaker_verifier

logger = logging.getLogger(__name__)


class SpeakerService:
    """Service managing speaker profiles and voiceprint embeddings under tenant isolation."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.verifier = get_speaker_verifier()
        self.decoder = AudioDecoder()
        self.resampler = AudioResampler(target_sample_rate=16000)

    async def enroll_speaker(
        self,
        org_id: UUID,
        display_name: str,
        designation: str,
        audio_bytes_list: List[bytes],
        consent_timestamp: Optional[datetime] = None,
        user_id: Optional[UUID] = None,
    ) -> SpeakerProfile:
        """
        Process audio samples, extract 192-d centroid embedding vector, and save profile.
        
        Zero-Fake-Data Invariant:
        Propagates ModelUnavailableError if the underlying biometric model is unavailable.
        Never persists fabricated or zero-energy vectors to the database.
        """
        if not audio_bytes_list:
            raise AudioProcessingError("At least one audio sample is required for enrollment")

        processed_samples: List[np.ndarray] = []
        total_duration = 0.0

        for idx, raw_bytes in enumerate(audio_bytes_list):
            if not raw_bytes or len(raw_bytes) == 0:
                logger.warning(f"Enrollment sample {idx} is empty; skipping.")
                continue

            pcm16, sr, channels = self.decoder.decode(raw_bytes)
            # Resample to 16kHz mono float32
            resampled = self.resampler.resample_to_float32(pcm16, orig_sample_rate=sr)
            duration = len(resampled) / 16000.0
            if duration < 0.25:
                logger.warning(f"Enrollment sample {idx} is very short ({duration:.2f}s)")
            total_duration += duration
            processed_samples.append(resampled)

        if not processed_samples:
            raise AudioProcessingError("All provided enrollment audio samples were empty or invalid.")

        # Extract 192-d centroid vector from ECAPA verifier
        # If model is unavailable, ModelUnavailableError is raised and no DB record is created
        embedding_vec = await self.verifier.enroll(processed_samples, sample_rate=16000)

        profile = SpeakerProfile(
            org_id=org_id,
            user_id=user_id,
            display_name=display_name,
            designation=designation,
            consent_timestamp=consent_timestamp or datetime.now(timezone.utc),
            is_active=True,
        )
        self.db.add(profile)
        await self.db.flush()

        voiceprint = VoiceprintEmbedding(
            speaker_profile_id=profile.id,
            embedding=embedding_vec.tolist(),
            quality_score=1.0,
            sample_duration_seconds=total_duration,
        )
        self.db.add(voiceprint)
        await self.db.commit()
        await self.db.refresh(profile)

        logger.info(
            f"Enrolled speaker {profile.id} ({display_name}) with {len(processed_samples)} "
            f"samples ({total_duration:.1f}s total duration)"
        )
        return profile

    async def verify_speaker_audio(
        self,
        speaker_id: UUID,
        audio_bytes: bytes,
        threshold: Optional[float] = None,
    ) -> VerificationResult:
        """Verify incoming raw audio bytes against an enrolled speaker profile."""
        speaker_emb = await self.get_speaker_embedding(speaker_id)
        settings = get_settings()
        active_threshold = threshold if threshold is not None else settings.TRUEVOICE_SPEAKER_THRESHOLD

        if speaker_emb is None:
            return VerificationResult(
                verified=None,
                similarity=None,
                threshold=active_threshold,
                confidence=0.0,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=getattr(self.verifier, "model_name", "ecapa-tdnn"),
                model_version=getattr(self.verifier, "model_version", "v1.0"),
                inference_time_ms=0.0,
                distance=1.0,
                is_match=False,
            )

        pcm16, sr, channels = self.decoder.decode(audio_bytes)
        resampled = self.resampler.resample_to_float32(pcm16, orig_sample_rate=sr)
        return await self.verifier.verify(
            resampled,
            enrolled_embedding=speaker_emb,
            sample_rate=16000,
            threshold=active_threshold,
        )

    async def get_speaker(self, speaker_id: UUID, org_id: Optional[UUID] = None) -> SpeakerProfile:
        """Fetch speaker profile with tenant validation."""
        stmt = (
            select(SpeakerProfile)
            .where(SpeakerProfile.id == speaker_id)
        )
        result = await self.db.execute(stmt)
        speaker = result.scalar_one_or_none()

        if not speaker:
            raise ResourceNotFoundError("SpeakerProfile", str(speaker_id))
        if org_id and str(speaker.org_id) != str(org_id):
            raise TenantAccessViolation("Cannot access speaker profile belonging to another tenant")
        return speaker

    async def get_speaker_embedding(self, speaker_id: UUID) -> Optional[np.ndarray]:
        """Fetch active 192-d embedding vector for speaker."""
        stmt = (
            select(VoiceprintEmbedding)
            .where(VoiceprintEmbedding.speaker_profile_id == speaker_id)
            .order_by(desc(VoiceprintEmbedding.enrolled_at))
            .limit(1)
        )
        result = await self.db.execute(stmt)
        vp = result.scalar_one_or_none()
        if not vp:
            return None
        return np.array(vp.embedding, dtype=np.float32)

    async def list_speakers(
        self,
        org_id: UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> List[SpeakerProfile]:
        """List active speaker profiles for tenant."""
        stmt = (
            select(SpeakerProfile)
            .where(SpeakerProfile.org_id == org_id, SpeakerProfile.is_active == True)
            .order_by(desc(SpeakerProfile.created_at))
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def deactivate_speaker(self, speaker_id: UUID, org_id: UUID) -> SpeakerProfile:
        """Deactivate a speaker profile (soft delete)."""
        speaker = await self.get_speaker(speaker_id, org_id)
        speaker.is_active = False
        await self.db.commit()
        await self.db.refresh(speaker)
        return speaker
