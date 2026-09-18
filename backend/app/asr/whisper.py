"""
Faster-Whisper Speech Recognition Adapter.
Production streaming transcription using CTranslate2/faster-whisper.
Operates in Branch 2 (Conversational Context & Threat Analysis).
"""

import time
import logging
from typing import List, Optional
import numpy as np

from app.config import get_settings
from app.asr.base import ASRResult, SpeechRecognizer
from app.core.constants import SignalAvailability

logger = logging.getLogger(__name__)


class WhisperSpeechRecognizer(SpeechRecognizer):
    """
    Production ASR adapter wrapping faster-whisper (CTranslate2 backend).
    
    Architectural Features:
    - Supports configurable model size (tiny, base, small, medium, large-v3).
    - CPU/GPU execution with configurable compute types ('int8', 'float16', 'float32', 'auto').
    - Multilingual transcription (English, Hindi, Punjabi, and code-switched speech)
      via dynamic language auto-detection or tenant configuration.
    - Zero-Fake-Data Guarantee: If faster-whisper or weights are unavailable, reports
      SignalAvailability.UNAVAILABLE and NEVER outputs synthetic/simulated dialogue.
    - Privacy & Security: Never logs raw audio; redacts/truncates transcripts in logs.
    """

    def __init__(
        self,
        model_size: Optional[str] = None,
        device: Optional[str] = None,
        compute_type: Optional[str] = None,
        model_version: Optional[str] = None,
    ):
        settings = get_settings()
        self.model_size = model_size or settings.TRUEVOICE_ASR_MODEL
        self.device = device or settings.TRUEVOICE_ASR_DEVICE
        self.compute_type = compute_type or settings.TRUEVOICE_ASR_COMPUTE_TYPE
        self.model_version = model_version or f"faster-whisper-{self.model_size}-v1.0"
        self.model_name = f"faster-whisper-{self.model_size}"
        self.beam_size = settings.TRUEVOICE_ASR_BEAM_SIZE
        self.default_language = settings.TRUEVOICE_ASR_LANGUAGE
        self.model = None
        self.is_loaded = False

    def load_model(self, device: Optional[str] = None) -> None:
        """
        Load faster-whisper CTranslate2 model into memory.
        Selects optimal compute_type based on target device (e.g. int8 for CPU, float16 for CUDA).
        """
        if device:
            self.device = device

        compute = self.compute_type
        if compute == "auto":
            compute = "float16" if self.device == "cuda" else "int8"

        try:
            from faster_whisper import WhisperModel

            logger.info(
                f"Loading faster-whisper model '{self.model_size}' "
                f"(Device: {self.device}, Compute: {compute})..."
            )
            self.model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=compute,
            )
            self.is_loaded = True
            logger.info(f"faster-whisper model '{self.model_name}' loaded successfully.")
        except Exception as exc:
            self.is_loaded = False
            self.model = None
            logger.warning(
                f"faster-whisper could not be loaded: {exc}. "
                f"ASR recognizer will report SignalAvailability.UNAVAILABLE in production."
            )

    async def transcribe(
        self,
        audio: np.ndarray,
        sample_rate: int = 16000,
        language: Optional[str] = None,
    ) -> ASRResult:
        """
        Transcribe 16kHz float32 audio chunk into text with confidence metrics.
        
        Multilingual Architecture:
        - If 'language' is None, faster-whisper runs automatic language detection across
          all supported Whisper languages (including English 'en', Hindi 'hi', Punjabi 'pa').
        - Code-switched speech is transcribed into the dominant detected language script.
        """
        start_t = time.perf_counter()

        # Handle empty audio chunk
        if audio is None or len(audio) == 0:
            return ASRResult(
                transcript="",
                confidence=0.0,
                token_log_probs=[],
                signal_availability=SignalAvailability.UNAVAILABLE,
                language=language or self.default_language or "unknown",
                duration_seconds=0.0,
                inference_time_ms=0.0,
                model_name=self.model_name,
                model_version=self.model_version,
            )

        duration = float(len(audio) / sample_rate)

        # Zero-Fake-Data Check: If model is not loaded, return explicit UNAVAILABLE
        if not self.is_loaded or self.model is None:
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            logger.warning("faster-whisper transcribe called but model is unavailable. Reporting UNAVAILABLE.")
            return ASRResult(
                transcript="",
                confidence=0.0,
                token_log_probs=[],
                signal_availability=SignalAvailability.UNAVAILABLE,
                language=language or self.default_language or "unknown",
                duration_seconds=round(duration, 2),
                inference_time_ms=round(elapsed_ms, 2),
                model_name=self.model_name,
                model_version=self.model_version,
            )

        try:
            # Normalize audio to 1D float32 in [-1.0, 1.0]
            audio_flat = np.asarray(audio, dtype=np.float32).flatten()
            audio_norm = np.clip(audio_flat, -1.0, 1.0)

            # Target language: priority goes to method arg -> config setting -> None (auto-detect)
            target_lang = language or self.default_language

            segments, info = self.model.transcribe(
                audio_norm,
                beam_size=self.beam_size,
                language=target_lang,
                vad_filter=False,  # Audio is already pre-filtered by TrueVoice DSP VAD in pipeline
            )

            detected_language = info.language if hasattr(info, "language") else (target_lang or "unknown")

            texts: List[str] = []
            log_probs: List[float] = []

            for seg in segments:
                text_clean = seg.text.strip()
                if text_clean:
                    texts.append(text_clean)
                if hasattr(seg, "avg_logprob") and seg.avg_logprob is not None:
                    log_probs.append(float(seg.avg_logprob))

            full_transcript = " ".join(texts).strip()

            # Confidence calculation: avg_logprob is log-likelihood (typically <= 0).
            # exp(avg_logprob) maps to [0.0, 1.0].
            if log_probs:
                mean_logprob = float(np.mean(log_probs))
                confidence = float(np.clip(np.exp(mean_logprob), 0.0, 1.0))
            else:
                confidence = 0.0

            # Determine signal availability based on presence of speech
            if not full_transcript:
                availability = SignalAvailability.LOW_CONFIDENCE
            elif confidence < 0.25:
                availability = SignalAvailability.LOW_CONFIDENCE
            else:
                availability = SignalAvailability.AVAILABLE

            elapsed_ms = (time.perf_counter() - start_t) * 1000.0

            # Security: Redacted logging (first 25 chars only, no raw audio)
            redacted_preview = (
                (full_transcript[:25] + "...") if len(full_transcript) > 25 else full_transcript
            )
            logger.debug(
                f"ASR transcribed {duration:.2f}s ({detected_language}) in {elapsed_ms:.1f}ms: "
                f"'{redacted_preview}' (conf={confidence:.2f})"
            )

            return ASRResult(
                transcript=full_transcript,
                confidence=round(confidence, 3),
                token_log_probs=log_probs,
                signal_availability=availability,
                language=detected_language,
                duration_seconds=round(duration, 2),
                inference_time_ms=round(elapsed_ms, 2),
                model_name=self.model_name,
                model_version=self.model_version,
            )

        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            logger.error(f"faster-whisper transcription error: {exc}")
            return ASRResult(
                transcript="",
                confidence=0.0,
                token_log_probs=[],
                signal_availability=SignalAvailability.UNAVAILABLE,
                language=language or self.default_language or "unknown",
                duration_seconds=round(duration, 2),
                inference_time_ms=round(elapsed_ms, 2),
                model_name=self.model_name,
                model_version=self.model_version,
            )

    def get_model_version(self) -> str:
        return self.model_version
