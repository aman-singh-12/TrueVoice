"""
Pydantic Schemas for Audio File Analysis Endpoint.
Defines authoritative contracts for dual-file batch analysis (reference vs suspected audio).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import RiskTier, TrustState, SecurityActionType, SignalAvailability


class AudioFileMetadata(BaseModel):
    """Metadata for uploaded audio file."""
    filename: str
    size_bytes: int
    duration_seconds: float
    sample_rate: int
    channels: int
    format: str


class DeepfakeSignalDetail(BaseModel):
    """Deepfake detection signal details."""
    score: float = Field(..., ge=0.0, le=100.0, description="Synthetic likelihood score (0-100)")
    label: str = Field(..., description="'SYNTHETIC' or 'AUTHENTIC'")
    confidence: Optional[float] = None
    signal_availability: SignalAvailability = SignalAvailability.AVAILABLE
    model_name: str
    model_version: str
    inference_time_ms: float = 0.0


class SpeakerSignalDetail(BaseModel):
    """Speaker verification signal details."""
    similarity: Optional[float] = Field(None, description="Geometric cosine similarity [0.0, 1.0]")
    threshold: float = Field(0.75, description="Configured verification threshold")
    is_match: Optional[bool] = None
    confidence: Optional[float] = None
    signal_availability: SignalAvailability = SignalAvailability.AVAILABLE
    model_name: str
    model_version: str
    inference_time_ms: float = 0.0


class ForensicsSignalDetail(BaseModel):
    """Acoustic DSP forensic signal details."""
    score: float = Field(..., ge=0.0, le=100.0, description="Acoustic anomaly score (0-100)")
    signal_availability: SignalAvailability = SignalAvailability.AVAILABLE
    f0_mean: Optional[float] = None
    f0_std: Optional[float] = None
    jitter_local: Optional[float] = None
    shimmer_local: Optional[float] = None
    hnr_db: Optional[float] = None
    spectral_centroid_mean: Optional[float] = None
    spectral_rolloff_mean: Optional[float] = None
    spectral_flux_mean: Optional[float] = None
    rms_energy_mean: Optional[float] = None
    anomalies_detected: List[str] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)
    model_name: str = "dsp-forensic-analyzer"
    model_version: str = "v1.2.0"


class ConversationSignalDetail(BaseModel):
    """ASR & conversational threat intent details."""
    threat_score: float = Field(0.0, ge=0.0, le=1.0, description="Conversational threat score (0.0 - 1.0)")
    detected_intents: List[str] = Field(default_factory=list)
    transcript: Optional[str] = None
    language: Optional[str] = None
    confidence: Optional[float] = None
    signal_availability: SignalAvailability = SignalAvailability.AVAILABLE
    model_name: str
    model_version: str


class ContextSignalDetail(BaseModel):
    """Contextual and transaction risk details."""
    score: float = Field(0.0, ge=0.0, le=1.0)
    signal_availability: SignalAvailability = SignalAvailability.AVAILABLE
    risk_factors: List[str] = Field(default_factory=list)
    features: Dict[str, Any] = Field(default_factory=dict)


class AnalysisSignals(BaseModel):
    """Aggregated signal breakdown."""
    deepfake: DeepfakeSignalDetail
    speaker: SpeakerSignalDetail
    forensics: ForensicsSignalDetail
    conversation: ConversationSignalDetail
    context: ContextSignalDetail


class AnalysisModelProvenance(BaseModel):
    """Model architectures and execution runtime provenance."""
    deepfake_model: str
    deepfake_model_version: str
    speaker_model: str
    speaker_model_version: str
    asr_model: str
    asr_model_version: str
    ml_mode: str
    ml_device: str


class AudioAnalysisResponse(BaseModel):
    """
    Authoritative response schema for POST /v1/analyze/audio.
    Synthesizes all 5 intelligence branches, multi-signal fusion, and declarative policy.
    """
    analysis_id: str
    status: str = "COMPLETED"
    created_at: datetime
    reference_audio: AudioFileMetadata
    suspected_audio: AudioFileMetadata
    
    # Primary Verdicts
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Authoritative composite risk score (0-100)")
    risk_tier: RiskTier
    trust_state: TrustState
    security_action: SecurityActionType
    action_reason: str
    rule_matched: str

    # Evidence and Provenance
    primary_factors: List[str] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)
    
    # Granular Signal Breakdown
    signals: AnalysisSignals
    
    # Engine & Model Provenance
    provenance: AnalysisModelProvenance
    
    # Execution Timing
    pipeline_stages_completed: List[str] = Field(default_factory=list)
    total_processing_time_ms: float

    model_config = ConfigDict(from_attributes=True)
