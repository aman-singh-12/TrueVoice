"""
TrueVoice Centralized Configuration Layer.
Pydantic v2 Settings loading from environment variables with safe defaults.
Never hardcodes secrets or passwords.
"""

from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Project Info
    PROJECT_NAME: str = "TrueVoice"
    VERSION: str = "1.2.0"
    API_V1_STR: str = "/v1"
    ENVIRONMENT: str = "development"  # development, production, test
    DEBUG: bool = False

    # Machine Learning Execution Mode
    # "mock": Deterministic fast simulations without heavy checkpoints (CI / tests)
    # "live": Full PyTorch/SpeechBrain/Whisper models
    TRUEVOICE_ML_MODE: str = "mock"

    # Security & Authentication
    SECRET_KEY: str = "truevoice-dev-insecure-secret-key-change-in-production-2026"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    WS_TOKEN_EXPIRE_MINUTES: int = 5

    # Database Configuration (Default: PostgreSQL 16 with pgvector)
    DATABASE_URL: str = "postgresql+asyncpg://truevoice:truevoice@localhost:5432/truevoice_db"
    # Secondary URL for isolated in-memory unit testing
    SQLITE_TEST_URL: str = "sqlite+aiosqlite:///:memory:"

    # Redis Configuration (Optional real-time pub/sub cache)
    REDIS_URL: Optional[str] = None

    # Canonical Audio Processing Parameters
    SAMPLE_RATE: int = 16000
    WINDOW_SECONDS: float = 2.0
    HOP_SECONDS: float = 0.5
    CHANNELS: int = 1

    @property
    def WINDOW_SAMPLES(self) -> int:
        return int(self.SAMPLE_RATE * self.WINDOW_SECONDS)

    @property
    def HOP_SAMPLES(self) -> int:
        return int(self.SAMPLE_RATE * self.HOP_SECONDS)

    # Active Model Configurations
    DEEPFAKE_PRIMARY_DETECTOR: str = "wav2vec2"  # wav2vec2, rawnet2, aasist, ensemble, mock
    DEEPFAKE_SECONDARY_DETECTOR: Optional[str] = None
    TRUEVOICE_WAV2VEC2_MODEL: Optional[str] = None
    TRUEVOICE_RAWNET2_MODEL: Optional[str] = None
    TRUEVOICE_AASIST_MODEL: Optional[str] = None
    TRUEVOICE_ML_DEVICE: str = "cpu"  # cpu or cuda
    SPEAKER_VERIFIER_MODEL: str = "ecapa"
    ASR_MODEL: str = "faster-whisper-small"  # tiny, base, small, medium, large-v3

    # ECAPA-TDNN Speaker Verification Configuration
    # NOTE: TRUEVOICE_SPEAKER_THRESHOLD is a configurable operational threshold (operating point)
    # on normalized geometric similarity in [0.0, 1.0], not an empirically validated universal EER constant.
    TRUEVOICE_SPEAKER_THRESHOLD: float = 0.75
    SPEAKER_COSINE_THRESHOLD: float = 0.75  # Backward compatibility alias
    TRUEVOICE_SPEAKER_DEVICE: str = "cpu"    # "cpu" or "cuda"
    SPEAKER_MODEL_SOURCE: str = "speechbrain/spkrec-ecapa-voxceleb"

    # Faster-Whisper Automatic Speech Recognition (ASR) Configuration
    TRUEVOICE_ASR_MODEL: str = "small"       # tiny, base, small, medium, large-v3
    TRUEVOICE_ASR_DEVICE: str = "cpu"        # "cpu" or "cuda"
    TRUEVOICE_ASR_COMPUTE_TYPE: str = "int8" # "int8", "float16", "float32", "auto"
    # Multilingual support: None enables automatic language detection (English, Hindi, Punjabi, code-switched)
    TRUEVOICE_ASR_LANGUAGE: Optional[str] = None
    TRUEVOICE_ASR_BEAM_SIZE: int = 5

    # Baseline Multi-Signal Risk Fusion Weights (Sum = 1.0)
    WEIGHT_DEEPFAKE: float = 0.35
    WEIGHT_SPEAKER: float = 0.25
    WEIGHT_CONVERSATION: float = 0.15
    WEIGHT_CONTEXT: float = 0.15
    WEIGHT_FORENSIC: float = 0.10

    # Compounding Multiplier & Smoothing
    GAMMA_MULTIPLIER: float = 1.35
    EMA_ATTACK_ALPHA: float = 0.60
    EMA_DECAY_ALPHA: float = 0.20

    # Declarative Policy Thresholds
    CAUTION_THRESHOLD: float = 30.0
    VERIFY_THRESHOLD: float = 60.0
    BLOCK_THRESHOLD: float = 80.0
    SENSITIVE_AMOUNT_THRESHOLD: float = 250000.0  # ₹2.5 Lakh demo threshold

    # Forensic Heuristic Baseline Values (Configurable baseline, not universal constants)
    FORENSIC_F0_STEP_HZ: float = 50.0
    FORENSIC_JITTER_MAX: float = 0.002   # 0.2%
    FORENSIC_SHIMMER_MAX: float = 0.015  # 1.5%
    FORENSIC_HNR_MIN_DB: float = 15.0

    # Out-of-Band Verification Challenge TTL
    OOB_CHALLENGE_TTL_SECONDS: int = 30

    # Logging
    LOG_LEVEL: str = "INFO"

    @property
    def truevoice_ml_mode(self) -> str:
        return self.TRUEVOICE_ML_MODE

    @property
    def ml_mock_mode(self) -> bool:
        return self.TRUEVOICE_ML_MODE.lower() == "mock"


    @property
    def ml_device(self) -> str:
        return self.TRUEVOICE_ML_DEVICE

    @property
    def secret_key(self) -> str:
        return self.SECRET_KEY

    @property
    def log_level(self) -> str:
        return self.LOG_LEVEL

    @property
    def window_seconds(self) -> float:
        return self.WINDOW_SECONDS

    @property
    def hop_seconds(self) -> float:
        return self.HOP_SECONDS

    @property
    def jwt_access_token_expire_minutes(self) -> int:
        return self.ACCESS_TOKEN_EXPIRE_MINUTES

    @property
    def ws_ticket_expire_seconds(self) -> int:
        return self.WS_TOKEN_EXPIRE_MINUTES * 60

    @property
    def risk_critical_threshold(self) -> float:
        return self.BLOCK_THRESHOLD

    @property
    def risk_high_threshold(self) -> float:
        return self.VERIFY_THRESHOLD

    @property
    def risk_moderate_threshold(self) -> float:
        return self.CAUTION_THRESHOLD

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()


def get_settings() -> Settings:
    """Return the global Settings instance."""
    return settings

