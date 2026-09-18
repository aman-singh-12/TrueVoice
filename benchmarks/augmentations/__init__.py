"""
Acoustic Augmentation and Codec Degradation Package.
Adapted from research in audio-df-ucb/ClonedVoiceDetection.
"""

from benchmarks.augmentations.codec_simulator import CodecSimulator
from benchmarks.augmentations.acoustic_perturbations import AcousticPerturbations

__all__ = ["CodecSimulator", "AcousticPerturbations"]
