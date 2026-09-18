"""
ECAPA-TDNN Speaker Verification Adapter (SpeechBrain Architecture).
Extracts 192-dimensional embeddings and computes normalized geometric similarity.
Operates strictly in Branch 2 (Identity Verification). Never evaluates synthetic artifacts.
"""

import time
import logging
from typing import List, Optional
import numpy as np

from app.config import get_settings
from app.core.constants import SignalAvailability
from app.core.exceptions import AudioProcessingError, ModelUnavailableError
from app.schemas.speaker import VerificationResult, SpeakerVerificationResult
from app.speaker.base import SpeakerVerifier

logger = logging.getLogger(__name__)


class ECAPASpeakerVerifier(SpeakerVerifier):
    """
    SpeechBrain ECAPA-TDNN 192-dimensional speaker recognition model adapter.
    Uses official pretrained SpeechBrain weights ('speechbrain/spkrec-ecapa-voxceleb').
    
    Zero-Fake-Data Guarantee:
    If SpeechBrain or pretrained weights are unavailable, this class reports model
    unavailability and NEVER falls back to FFT-based or synthetic embeddings.
    """

    def __init__(
        self,
        model_version: str = "spkrec-ecapa-voxceleb-v1.0",
        model_source: Optional[str] = None,
        device: str = "cpu",
    ):
        settings = get_settings()
        self.model_version = model_version
        self.model_name = "ecapa-tdnn"
        self.model_source = model_source or settings.SPEAKER_MODEL_SOURCE
        self.classifier = None
        self.device = device or settings.TRUEVOICE_SPEAKER_DEVICE
        self.is_loaded = False

    def load_model(self, device: Optional[str] = None) -> None:
        """
        Load pretrained SpeechBrain ECAPA-TDNN weights into memory.
        Compatible with both SpeechBrain >= 1.0 (inference module) and < 1.0 (pretrained module).
        """
        if device:
            self.device = device
        try:
            # SpeechBrain >= 1.0
            try:
                from speechbrain.inference.speaker import SpeakerRecognition
            except ImportError:
                # SpeechBrain < 1.0 fallback
                from speechbrain.pretrained import SpeakerRecognition

            logger.info(
                f"Loading SpeechBrain ECAPA-TDNN from '{self.model_source}' on device '{self.device}'..."
            )
            self.classifier = SpeakerRecognition.from_hparams(
                source=self.model_source,
                run_opts={"device": self.device},
            )
            self.is_loaded = True
            logger.info(f"SpeechBrain ECAPA-TDNN successfully initialized ({self.model_version})")
        except Exception as exc:
            self.is_loaded = False
            self.classifier = None
            logger.warning(
                f"SpeechBrain ECAPA-TDNN could not be loaded: {exc}. "
                f"Speaker verifier will report ModelUnavailable in production."
            )

    def _extract_embedding(self, audio: np.ndarray) -> np.ndarray:
        """
        Extract a 192-dimensional unit L2-normalized embedding vector.
        
        Raises:
            ModelUnavailableError: If SpeechBrain model is not loaded.
            AudioProcessingError: If audio is empty or malformed.
        """
        if not self.is_loaded or self.classifier is None:
            raise ModelUnavailableError(
                self.model_name,
                "SpeechBrain ECAPA-TDNN model weights are not loaded. "
                "Production mode strictly forbids fabricated/FFT embeddings."
            )

        if len(audio) == 0:
            raise AudioProcessingError("Cannot extract embedding from empty audio buffer.")

        import torch

        # Preprocessing: Ensure 16kHz float32 1D audio clamped in [-1.0, 1.0]
        audio_clean = np.clip(audio.astype(np.float32), -1.0, 1.0)
        tensor = torch.as_tensor(audio_clean, dtype=torch.float32).unsqueeze(0).to(self.device)

        with torch.no_grad():
            emb = self.classifier.encode_batch(tensor)
            # SpeechBrain output shape is typically [batch, 1, 192] or [batch, 192]
            emb_np = emb.squeeze().detach().cpu().numpy().astype(np.float32)

        # Flatten in case of extra singleton dimensions
        emb_flat = emb_np.flatten()
        if emb_flat.shape[0] != 192:
            raise AudioProcessingError(
                f"Unexpected ECAPA embedding dimension: expected 192, got {emb_flat.shape[0]}"
            )

        # Unit L2 normalization
        norm = float(np.linalg.norm(emb_flat)) + 1e-9
        return (emb_flat / norm).astype(np.float32)

    async def enroll(self, audio_samples: List[np.ndarray], sample_rate: int = 16000) -> np.ndarray:
        """
        Generate a normalized 192-d centroid embedding vector from one or more enrollment samples.
        
        Mathematical Pipeline:
        Sample 1 -> e_1 (unit-normalized)
        Sample 2 -> e_2 (unit-normalized)
        ...
        Centroid mu = (1/M) * sum(e_i)
        Final c = mu / ||mu||_2 (unit-normalized)
        
        Raises:
            AudioProcessingError: If no valid non-silent audio samples are provided.
            ModelUnavailableError: If the ECAPA model is unavailable.
        """
        if not audio_samples:
            raise AudioProcessingError("At least one audio sample is required for speaker enrollment.")

        valid_samples: List[np.ndarray] = []
        for idx, sample in enumerate(audio_samples):
            if sample is None or len(sample) == 0:
                logger.warning(f"Enrollment sample {idx} is empty; skipping.")
                continue

            # Ensure minimum duration of 0.25s (4000 samples at 16kHz)
            if len(sample) < 4000:
                logger.warning(
                    f"Enrollment sample {idx} is shorter than 0.25s ({len(sample)} samples); skipping."
                )
                continue

            # Verify non-trivial energy (filter near-zero noise floor)
            rms = float(np.sqrt(np.mean(sample.astype(np.float32) ** 2) + 1e-9))
            if rms < 0.005:
                logger.warning(
                    f"Enrollment sample {idx} has insufficient RMS energy ({rms:.5f}); skipping."
                )
                continue

            valid_samples.append(sample)

        if not valid_samples:
            raise AudioProcessingError(
                "All provided enrollment audio samples are empty, silent, or too short (<0.25s)."
            )

        embeddings: List[np.ndarray] = []
        for s in valid_samples:
            emb = self._extract_embedding(s)
            embeddings.append(emb)

        # Compute normalized multi-sample centroid
        centroid = np.mean(embeddings, axis=0)
        centroid_norm = float(np.linalg.norm(centroid)) + 1e-9
        unit_centroid = (centroid / centroid_norm).astype(np.float32)

        logger.info(
            f"Successfully enrolled speaker centroid across {len(embeddings)} valid samples "
            f"(dim={unit_centroid.shape[0]}, norm={np.linalg.norm(unit_centroid):.4f})"
        )
        return unit_centroid

    async def verify(
        self,
        audio: np.ndarray,
        enrolled_embedding: Optional[np.ndarray],
        sample_rate: int = 16000,
        threshold: Optional[float] = None,
    ) -> VerificationResult:
        """
        Verify live audio against an enrolled 192-d voiceprint centroid.
        
        Similarity Formulation:
        cos_sim = dot(e_live, c_enrolled) in [-1.0, 1.0]
        similarity = (cos_sim + 1.0) / 2.0 in [0.0, 1.0] (normalized geometric similarity)
        verified = similarity >= threshold
        
        NOTE: 'threshold' is a configurable operational operating point (default from config),
        not an empirically validated universal EER constant.
        """
        start_t = time.perf_counter()
        settings = get_settings()
        active_threshold = threshold if threshold is not None else settings.TRUEVOICE_SPEAKER_THRESHOLD

        # Case 1: No enrolled profile available
        if enrolled_embedding is None:
            return VerificationResult(
                verified=None,
                similarity=None,
                threshold=active_threshold,
                confidence=0.0,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=0.0,
                distance=1.0,
                is_match=False,
            )

        # Case 2: Empty or degenerate live audio
        if audio is None or len(audio) == 0:
            return VerificationResult(
                verified=None,
                similarity=None,
                threshold=active_threshold,
                confidence=0.0,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=0.0,
                distance=1.0,
                is_match=False,
            )

        # Case 3: Model is not loaded (fail gracefully without fabricated scores)
        if not self.is_loaded or self.classifier is None:
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            logger.warning("ECAPA-TDNN verify called but model is unavailable. Reporting UNAVAILABLE.")
            return VerificationResult(
                verified=None,
                similarity=None,
                threshold=active_threshold,
                confidence=0.0,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=round(elapsed_ms, 2),
                distance=1.0,
                is_match=False,
            )

        # Case 4: Live inference with loaded SpeechBrain model
        try:
            live_embedding = self._extract_embedding(audio)
            enrolled_clean = np.asarray(enrolled_embedding, dtype=np.float32)

            # Ensure enrolled embedding is unit-normalized
            enr_norm = float(np.linalg.norm(enrolled_clean)) + 1e-9
            enrolled_unit = enrolled_clean / enr_norm

            # Cosine similarity between two unit-norm 192-d vectors
            cosine_sim = float(np.dot(live_embedding, enrolled_unit))
            cosine_sim = float(np.clip(cosine_sim, -1.0, 1.0))

            # Normalized geometric similarity mapping: [-1, 1] -> [0, 1]
            similarity = float(np.clip((cosine_sim + 1.0) / 2.0, 0.0, 1.0))
            is_verified = bool(similarity >= active_threshold)
            distance = float(np.clip(1.0 - similarity, 0.0, 1.0))

            # Confidence is derived from separation distance to threshold
            # High confidence when clearly above or clearly below threshold
            margin = abs(similarity - active_threshold)
            confidence = float(np.clip(0.5 + margin, 0.5, 0.99))

            elapsed_ms = (time.perf_counter() - start_t) * 1000.0

            return VerificationResult(
                verified=is_verified,
                similarity=round(similarity, 4),
                threshold=active_threshold,
                confidence=round(confidence, 3),
                signal_availability=SignalAvailability.AVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=round(elapsed_ms, 2),
                distance=round(distance, 4),
                is_match=is_verified,
            )
        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            logger.error(f"ECAPA verification inference failure: {exc}")
            return VerificationResult(
                verified=None,
                similarity=None,
                threshold=active_threshold,
                confidence=0.0,
                signal_availability=SignalAvailability.UNAVAILABLE,
                model_name=self.model_name,
                model_version=self.model_version,
                inference_time_ms=round(elapsed_ms, 2),
                distance=1.0,
                is_match=False,
            )

    def get_model_version(self) -> str:
        return self.model_version
