# Third-Party Code, Model, & Research Attribution

TrueVoice incorporates, adapts, or references algorithms, model architectures, benchmark protocols, dataset loaders, and acoustic degradation methodologies from open-source academic repositories. This document formalizes attribution, licenses, and compliance boundaries in adherence to SIH Problem Statement 26104 guidelines.

---

## Deepfake Detection Model Architectures

### 1. Repository 01: Voice Cloning Detector (Wav2Vec 2.0 Classification)
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

### 2. Repository 03: AASIST (Integrated Spectro-Temporal Graph Attention)
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

### 3. Repository 04: RawNet2 (Canonical Raw Waveform Anti-Spoofing)
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

### 4. Unapproved / Excluded Repositories
- **Repository 08**: Explicitly excluded from production runtime due to restrictive / non-commercial licensing constraints and obsolete 2D spectrogram CNN architectures. TrueVoice maintains clean room implementation boundaries.

---

## Benchmark Protocols & Research Attribution

### 5. audio-df-ucb / ClonedVoiceDetection

- **Authors / Organization**: UC Berkeley (audio-df-ucb)
- **Repository**: [https://github.com/audio-df-ucb/ClonedVoiceDetection](https://github.com/audio-df-ucb/ClonedVoiceDetection)
- **License**: BSD 3-Clause License
- **TrueVoice Adaptation**:
  - Codec simulation routines: G.711 $\mu$-law and A-law companding, 8-bit quantization.
  - Telephony channel degradation: PSTN bandpass filtering ($300\text{ Hz} \le f \le 3400\text{ Hz}$) and $8\text{ kHz}$ narrowband downsampling/upsampling.
  - VoIP packet loss simulation and jitter simulation in `benchmarks/augmentations/codec_simulator.py`.
- **License Notice**:
  ```
  Copyright (c) 2021, The Regents of the University of California
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:
  1. Redistributions of source code must retain the above copyright notice, this
     list of conditions and the following disclaimer.
  2. Redistributions in binary form must reproduce the above copyright notice,
     this list of conditions and the following disclaimer in the documentation
     and/or other materials provided with the distribution.
  3. Neither the name of the University of California, Berkeley nor the names of
     its contributors may be used to endorse or promote products derived from
     this software without specific prior written permission.
  ```

---

### 6. RUB-SysSec / WaveFake

- **Authors / Organization**: Joel Frank, Thorsten Holz — Ruhr University Bochum (Chair for System Security)
- **Paper**: *"WaveFake: A Data Set to Facilitate Audio Deepfake Detection"* (ACM MM 2021)
- **Repository**: [https://github.com/RUB-SysSec/wavefake](https://github.com/RUB-SysSec/wavefake)
- **License**:
  - Code: MIT License / BSD
  - Dataset: Creative Commons Attribution 4.0 International (CC BY 4.0)
- **TrueVoice Adaptation**:
  - Out-of-distribution neural vocoder evaluation protocol across six vocoder architectures: MelGAN, Parallel WaveGAN, Multi-Band MelGAN, HiFi-GAN, WaveGlow, and FullSubNet.
  - Dataset adapter and loader in `benchmarks/datasets/wavefake/loader.py`.
  - TrueVoice strictly complies with CC BY 4.0 and does not redistribute the raw 30GB dataset within the repository.

---

### 7. ASVspoof Consortium (ASVspoof 2019 / 2021)

- **Authors**: ASVspoof Consortium
- **Website**: [https://www.asvspoof.org/](https://www.asvspoof.org/)
- **TrueVoice Adaptation**:
  - Standard Logical Access (LA) and Physical Access (PA) trial evaluation protocols.
  - Metric standards: Equal Error Rate (EER), False Acceptance Rate (FAR), and False Rejection Rate (FRR).
