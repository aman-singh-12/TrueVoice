"""
TrueVoice Speaker Biometric Profile API Endpoints.
Handles speaker enrollment, profile retrieval, and biometric deactivation.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import Role
from app.dependencies import get_db, get_current_user, AuthenticatedUser, require_roles
from app.schemas.speaker import SpeakerResponse
from app.services.speaker_service import SpeakerService

router = APIRouter(prefix="/v1/speakers", tags=["Speaker Biometrics"])


@router.post("/enroll", response_model=SpeakerResponse, status_code=status.HTTP_201_CREATED)
async def enroll_speaker(
    display_name: str = Form(...),
    designation: str = Form(...),
    user_id: Optional[str] = Form(None),
    audio_files: List[UploadFile] = File(...),
    current_user: AuthenticatedUser = Depends(require_roles([Role.SECURITY_ANALYST, Role.ORG_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Enroll a new speaker profile with 192-dimensional unit-hypersphere voiceprint embedding.
    Accepts 1 or more WAV/PCM audio samples.
    """
    if not audio_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one audio file must be uploaded for enrollment"
        )

    audio_bytes_list: List[bytes] = []
    for f in audio_files:
        content = await f.read()
        if len(content) > 0:
            audio_bytes_list.append(content)

    if not audio_bytes_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio files were empty"
        )

    speaker_service = SpeakerService(db)
    profile = await speaker_service.enroll_speaker(
        org_id=UUID(current_user.org_id),
        display_name=display_name,
        designation=designation,
        audio_bytes_list=audio_bytes_list,
        user_id=UUID(user_id) if user_id else None
    )

    return SpeakerResponse(
        id=str(profile.id),
        org_id=str(profile.org_id),
        display_name=profile.display_name,
        designation=profile.designation,
        is_active=profile.is_active,
        created_at=profile.created_at,
        has_enrolled_voiceprint=True,
    )


@router.get("", response_model=List[SpeakerResponse])
async def list_speakers(
    skip: int = 0,
    limit: int = 50,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List active enrolled speaker profiles for tenant."""
    speaker_service = SpeakerService(db)
    profiles = await speaker_service.list_speakers(org_id=UUID(current_user.org_id), skip=skip, limit=limit)
    return [
        SpeakerResponse(
            id=str(p.id),
            org_id=str(p.org_id),
            display_name=p.display_name,
            designation=p.designation,
            is_active=p.is_active,
            created_at=p.created_at,
            has_enrolled_voiceprint=len(p.voiceprints) > 0 if hasattr(p, "voiceprints") else True,
        )
        for p in profiles
    ]


@router.get("/{speaker_id}", response_model=SpeakerResponse)
async def get_speaker(
    speaker_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve speaker profile by ID."""
    speaker_service = SpeakerService(db)
    profile = await speaker_service.get_speaker(speaker_id=speaker_id, org_id=UUID(current_user.org_id))
    return SpeakerResponse(
        id=str(profile.id),
        org_id=str(profile.org_id),
        display_name=profile.display_name,
        designation=profile.designation,
        is_active=profile.is_active,
        created_at=profile.created_at,
        has_enrolled_voiceprint=True,
    )


@router.delete("/{speaker_id}", response_model=SpeakerResponse)
async def deactivate_speaker(
    speaker_id: UUID,
    current_user: AuthenticatedUser = Depends(require_roles([Role.SECURITY_ANALYST, Role.ORG_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Deactivate a speaker profile (soft delete)."""
    speaker_service = SpeakerService(db)
    profile = await speaker_service.deactivate_speaker(speaker_id=speaker_id, org_id=UUID(current_user.org_id))
    return SpeakerResponse(
        id=str(profile.id),
        org_id=str(profile.org_id),
        display_name=profile.display_name,
        designation=profile.designation,
        is_active=profile.is_active,
        created_at=profile.created_at,
        has_enrolled_voiceprint=False,
    )
