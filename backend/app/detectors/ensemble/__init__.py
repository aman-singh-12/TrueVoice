"""
Ensemble Deepfake Detector Module.
Coordinates multi-architecture deepfake verification across Wav2Vec2, RawNet2, and AASIST.
"""

from app.detectors.ensemble.detector import EnsembleDetector

__all__ = ["EnsembleDetector"]
