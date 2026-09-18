"""Wav2Vec2-based synthetic speech detection."""

from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Any

import numpy as np


@dataclass(frozen=True)
class DeepfakeAnalysisResult:
    """A model result normalized for the TrueVoice risk engine."""

    synthetic_probability: float
    bonafide_probability: float
    vocoder_artifact_score: float
    model_version: str
    inference_latency_ms: float


class DeepfakeDetector:
    """Detect AI-generated speech with the fine-tuned Wav2Vec2 model.

    Dependencies are imported only when the detector is constructed without
    injected model components. This makes application startup and unit tests
    independent of the optional ML stack.
    """

    DEFAULT_MODEL_NAME = "garystafford/wav2vec2-deepfake-voice-detector"
    SAMPLE_RATE = 16_000

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL_NAME,
        device: str | None = None,
        *,
        model: Any | None = None,
        feature_extractor: Any | None = None,
        torch_module: Any | None = None,
    ) -> None:
        if (model is None) != (feature_extractor is None):
            raise ValueError("model and feature_extractor must be provided together")

        if model is None:
            try:
                import torch
                from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
            except ImportError as error:
                raise RuntimeError(
                    "Install the ML dependencies with: pip install -r requirements.txt"
                ) from error

            torch_module = torch
            model = AutoModelForAudioClassification.from_pretrained(model_name)
            feature_extractor = AutoFeatureExtractor.from_pretrained(model_name)

        if torch_module is None:
            try:
                import torch
            except ImportError as error:
                raise RuntimeError("PyTorch is required for inference") from error
            torch_module = torch

        self.model_name = model_name
        self._torch = torch_module
        self._model = model
        self._feature_extractor = feature_extractor
        self.device = device or ("cuda" if torch_module.cuda.is_available() else "cpu")
        self._model.to(self.device)
        self._model.eval()

    def predict(self, audio: np.ndarray | Any) -> DeepfakeAnalysisResult:
        """Classify a mono waveform sampled at 16 kHz.

        The Hugging Face model defines class 0 as real/bonafide and class 1 as
        fake/synthetic. Audio files should be decoded and resampled before
        calling this method; use :meth:`predict_file` for that workflow.
        """
        waveform = self._validate_audio(audio)
        started = perf_counter()
        inputs = self._feature_extractor(
            waveform,
            sampling_rate=self.SAMPLE_RATE,
            return_tensors="pt",
            padding=True,
        )
        inputs = {key: value.to(self.device) for key, value in inputs.items()}

        with self._torch.no_grad():
            logits = self._model(**inputs).logits
            probabilities = self._torch.nn.functional.softmax(logits, dim=-1)[0]

        bonafide_probability = float(probabilities[0].item())
        synthetic_probability = float(probabilities[1].item())
        elapsed_ms = (perf_counter() - started) * 1000

        return DeepfakeAnalysisResult(
            synthetic_probability=synthetic_probability,
            bonafide_probability=bonafide_probability,
            vocoder_artifact_score=0.0,
            model_version=self.model_name,
            inference_latency_ms=elapsed_ms,
        )

    def predict_file(self, audio_path: str) -> DeepfakeAnalysisResult:
        """Decode an audio file, convert it to mono 16 kHz, and classify it."""
        try:
            import librosa
        except ImportError as error:
            raise RuntimeError(
                "Install librosa to classify audio files: pip install librosa"
            ) from error

        waveform, _ = librosa.load(audio_path, sr=self.SAMPLE_RATE, mono=True)
        return self.predict(waveform)

    @staticmethod
    def _validate_audio(audio: np.ndarray | Any) -> np.ndarray:
        waveform = np.asarray(audio, dtype=np.float32)
        if waveform.ndim != 1 or waveform.size == 0:
            raise ValueError("audio must be a non-empty mono waveform")
        if not np.isfinite(waveform).all():
            raise ValueError("audio must contain only finite values")
        return waveform
