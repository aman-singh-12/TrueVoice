# Repository Analysis 03: clovaai / aasist

## 1. Executive Summary & Purpose
- **Repository**: `clovaai/aasist`
- **Primary Domain**: State-of-the-art audio anti-spoofing using graph neural networks on raw waveforms.
- **Purpose**: Implements AASIST (Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention Networks) and AASIST-L (lightweight variant). Uses heterogeneous graph attention networks to model relationships between spectral and temporal artifact nodes directly from raw waveforms without Short-Time Fourier Transforms.
- **Architectural Fit**: Serves as the **High-Performance Candidate Deepfake Detector** in TrueVoice **Branch 1 (Acoustic Integrity & Artifact Detection)** and the primary academic benchmark baseline for comparing EER against RawNet2 and Wav2Vec2.

---

## 2. Relevant Capability
- **Sinc-Convolutional Frontend**: Parametric sinc filters learning bandpass filterbanks directly from raw PCM waveforms (similar to SincNet).
- **Heterogeneous Graph Attention Networks**: Modeling spectro-temporal interactions across heterogeneous graph nodes (temporal graph, spectral graph, and unified readout node).
- **Low Error Rate Baseline**: Achieves competitive academic performance on ASVspoof 2019 LA ($\approx 0.83\%$ EER; min t-DCF $\approx 0.0275$).

---

## 3. Potential TrueVoice Components
| TrueVoice Module | Extracted / Referenced Capability | Architectural Role |
| :--- | :--- | :--- |
| `models.aasist_detector` | Heterogeneous Graph Attention Network | Advanced deepfake detection candidate behind `DeepfakeDetector` |
| `benchmarks.baseline_aasist` | Canonical ASVspoof 2019 reference baseline | Evaluating TrueVoice models against published state of the art |

---

## 4. Reusable Code & Implementations
- **Sinc-Filterbank & Residual Blocks**: Clean PyTorch implementation of parametric raw waveform bandpass filtering.
- **Graph Attention Module**: Graph construction routines converting 2D spectro-temporal feature maps into temporal/spectral adjacency graphs and executing multi-head attention graph convolutions without external heavy graph frameworks.

---

## 5. Reusable Model Checkpoints
- **Official Checkpoints**:
  - `AASIST.pth`: Full model (~297k parameters).
  - `AASIST-L.pth`: Lightweight variant (~85k parameters).
- **Input Specifications**: Single-channel 16 kHz raw audio waveforms ($64,600$ samples $\approx 4.0375$ seconds).
- **Inference Latency Profile**:
  - `AASIST`: ~45–65 ms on GPU; ~130–180 ms on CPU.
  - `AASIST-L`: ~20–35 ms on GPU; ~60–90 ms on CPU.

---

## 6. Datasets Used
- **ASVspoof 2019 Logical Access (LA)**: Standard benchmark containing genuine speech and spoofed speech from 17 different TTS and voice conversion algorithms (A01–A19).

---

## 7. License & Compliance Audit
- **License**: Apache License 2.0 (Permissive, robust corporate open source).
- **Modification Allowed**: Yes.
- **Commercial / Competition Use Allowed**: Yes, requires notice and attribution.
- **Patent Grant Clause**: Included in Apache 2.0.
- **Redistribution Stance**: Fully compliant with TrueVoice's integration architecture.

---

## 8. Dependencies & Environment
- `torch >= 1.9.0` (compatible with `torch >= 2.0.0`)
- `torchaudio >= 0.9.0`
- `numpy >= 1.20.0`
- `soundfile >= 0.10.0`
- No dependency on `torch_geometric` (graph operations implemented purely in native PyTorch tensors).

---

## 9. Risks & Limitations
1. **Dynamic Waveform Padding**: AASIST expects exact sample length ($64,600$ samples); incoming streaming chunks of differing durations ($1.0\text{s}$ to $3.0\text{s}$) must be circular-padded or sliced carefully to avoid boundary discontinuity artifacts.
2. **Channel Sensitivity**: Like most raw-waveform models, AASIST was trained predominantly on clean studio speech (ASVspoof 2019 LA) and degrades under lossy compression (e.g., G.711 / AMR / low-bitrate MP3) without domain adaptation.
3. **ONNX Export Complexity**: Graph attention matrix multiplications with dynamic masks require careful tracing to export successfully to ONNX Runtime.

---

## 10. Architectural Recommendation for TrueVoice
- **Extract & Adapt**:
  - Port `AASIST-L` (the lightweight variant) into `models.aasist_detector` encapsulated behind the `DeepfakeDetector` abstract base class.
  - Use AASIST in the TrueVoice offline benchmark suite (`benchmarks/benchmark_suite.py`) as the gold-standard comparison baseline.
  - In production deployment, provide a configuration toggle: allow running `RawNet2` or `AASIST-L` as the primary raw-waveform branch alongside `Wav2Vec2`, ensuring runtime latency stays within the target envelope ($\le 120\text{ ms}$).
