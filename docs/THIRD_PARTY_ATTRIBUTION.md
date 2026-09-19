# Third-Party Code & Model Attribution

TrueVoice incorporates, adapts, or references algorithms and model architectures from open-source academic repositories to deliver AI-driven deepfake detection. This document formalizes attribution, licenses, and compliance boundaries in adherence to SIH Problem Statement 26104 guidelines.

---

## 1. Repository 01: Voice Cloning Detector (Wav2Vec 2.0 Classification)
- **Upstream Repository**: [`Tejahudson/voice-cloning-detector`](https://github.com/Tejahudson/voice-cloning-detector)
- **Original Author**: Tejahudson
- **License**: MIT License
- **TrueVoice Module**: [`backend/app/detectors/wav2vec2/detector.py`](file:///backend/app/detectors/wav2vec2/detector.py)
- **Adopted Methodology**:
  - Fine-tuned Wav2Vec 2.0 sequence classification architecture for synthetic audio artifact detection.
  - Standardized RMS scaling to -24 dBFS and canonical 16 kHz sample rate preprocessing.
  - Real neural logits evaluation mapping to calibrated synthetic voice probabilities.
- **License Compliance**: Retained MIT attribution and open licensing compatibility.

---

## 2. Repository 03: AASIST (Integrated Spectro-Temporal Graph Attention)
- **Upstream Repository**: [`clovaai/aasist`](https://github.com/clovaai/aasist)
- **Original Authors**: Jee-weon Jung, Hee-Soo Heo, Hye-jin Shim, Bong-Jin Ko, Ha-Jin Yu (NAVER Corp. / Clova AI)
- **Paper**: *"AASIST: Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention Networks"*, Interspeech 2021.
- **License**: Apache License 2.0
- **TrueVoice Modules**:
  - Model: [`backend/app/detectors/aasist/model.py`](file:///backend/app/detectors/aasist/model.py)
  - Adapter: [`backend/app/detectors/aasist/detector.py`](file:///backend/app/detectors/aasist/detector.py)
- **Adopted Methodology**:
  - Parametric sinc-convolutional frontend filterbank (70 channels).
  - 2D spectro-temporal residual blocks and heterogeneous Graph Attention Layers (GAT) implemented in pure native PyTorch.
  - Direct raw waveform processing without STFT or external heavy graph dependencies.
- **License Compliance**: Includes required Apache 2.0 copyright notices and patent grant protections.

---

## 3. Repository 04: RawNet2 (Canonical Raw Waveform Anti-Spoofing)
- **Upstream Repository**: [`NTU-ROSE/RawNet2`](https://github.com/NTU-ROSE/RawNet2)
- **Original Authors**: Hemlata Tak, Jose Patino, Andreas Nautsch, Nicholas Evans, Massimiliano Todisco (EURECOM & NTU ROSE Lab)
- **Paper**: *"RawNet2: Squeeze-and-excitation residual networks on raw waveforms for audio anti-spoofing"*, Interspeech 2021.
- **License**: MIT License
- **TrueVoice Modules**:
  - Model: [`backend/app/detectors/rawnet2/model.py`](file:///backend/app/detectors/rawnet2/model.py)
  - Adapter: [`backend/app/detectors/rawnet2/detector.py`](file:///backend/app/detectors/rawnet2/detector.py)
- **Adopted Methodology**:
  - Canonical SincNet bandpass filters initialized along the mel scale.
  - Residual blocks featuring Frequency-domain Squeeze-and-Excitation (F-SE) recalibration.
  - Bidirectional GRU temporal pooling and linear classification head.
  - First-order pre-emphasis ($y[t] = x[t] - 0.97 \cdot x[t-1]$) and zero-mean unit-variance scaling.
- **License Compliance**: Retained original MIT license and copyright attribution.

---

## 4. Unapproved / Excluded Repositories
- **Repository 08**: Explicitly excluded from production runtime due to restrictive / non-commercial licensing constraints and obsolete 2D spectrogram CNN architectures. TrueVoice maintains clean room implementation boundaries.
