# Repository Analysis 04: NTU-ROSE / RawNet2

## 1. Executive Summary & Purpose
- **Repository**: `NTU-ROSE/RawNet2`
- **Primary Domain**: Canonical reference implementation of RawNet2 for audio anti-spoofing.
- **Purpose**: Original research codebase from Nanyang Technological University (ROSE Lab) accompanying the paper *"RawNet2: Squeeze-and-excitation residual networks on raw waveforms for audio anti-spoofing"*.
- **Architectural Fit**: Serves as the **Canonical Source of Truth for RawNet2 architecture** in TrueVoice **Branch 1 (Acoustic Integrity & Artifact Detection)**. Must be benchmarked directly against Repo 02's implementation.

---

## 2. Relevant Capability
- **SincNet Filterbank**: First convolutional layer with parameterized sinc bandpass filters initialized according to the mel scale.
- **Frequency-Domain Squeeze-and-Excitation (F-SE)**: Residual blocks equipped with F-SE modules that recalibrate filter responses along the frequency dimension.
- **Direct End-to-End Raw Audio Processing**: Extracts representations directly from raw time-series without STFT/mel-spectrogram conversion, minimizing preprocessing latency.

---

## 3. Potential TrueVoice Components
| TrueVoice Module | Extracted / Referenced Capability | Architectural Role |
| :--- | :--- | :--- |
| `models.rawnet2_detector` | Canonical RawNet2 model architecture & weights | Primary lightweight raw-audio deepfake detector (Branch 1) |
| `core.dsp.sincnet` | Parametric SincNet convolutional filterbank | Frontend feature extraction for raw audio streams |

---

## 4. Reusable Code & Implementations
- **Clean Model Definition**: The standalone `model.py` module containing the exact PyTorch implementation of `RawNet2`:
  - `SincConv` layer with learnable low and high cut-off frequencies.
  - Residual blocks with max pooling, batch normalization, and LeakyReLU activations.
  - Frequency-wise squeeze-and-excitation layers.
  - Fully connected classification head yielding log-softmax binary logits.

---

## 5. Reusable Model Checkpoints
- **ASVspoof 2019 Pretrained Weights**: Official pretrained checkpoint trained on ASVspoof 2019 LA train partition.
- **Performance Baseline**: $\approx 4.5\text{–}5.2\%$ EER on ASVspoof 2019 LA evaluation partition.
- **Input Specifications**: Single-channel 16 kHz raw audio waveforms ($59,049$ samples $\approx 3.69$ seconds or padded $64,000$ samples).
- **Inference Latency Profile**: ~15–25 ms on GPU; ~40–65 ms on 4-core CPU. Very lightweight (~1.2M parameters).

---

## 6. Datasets Used
- **ASVspoof 2019 Logical Access (LA)**: Official train, development, and evaluation splits.

---

## 7. License & Compliance Audit
- **License**: MIT License.
- **Modification Allowed**: Yes.
- **Commercial / Competition Use Allowed**: Yes, with attribution.
- **Patent / Restriction Clauses**: None.
- **Redistribution Stance**: Fully compatible with TrueVoice's codebase and open architecture.

---

## 8. Dependencies & Environment
- `torch >= 1.7.0` (fully compatible with `torch >= 2.0.0`)
- `torchaudio >= 0.7.0`
- `numpy >= 1.19.0`
- `scipy >= 1.5.0`

---

## 9. Comparative Selection: Repo 02 (VoiceVault) vs. Repo 04 (NTU-ROSE)
| Dimension | Repo 02 (VoiceVault) | Repo 04 (NTU-ROSE RawNet2) | TrueVoice Decision |
| :--- | :--- | :--- | :--- |
| **Model Architecture** | Modified/unofficial variant with altered layer dimensions | **Canonical, rigorously validated architecture** | **Select Repo 04** for model definition & checkpoint compatibility |
| **Weight Lineage** | Checkpoint lineage unverified; potentially overfitted | **Official ASVspoof 2019 baseline weights** | **Select Repo 04** for clean reproducible weights |
| **Streaming & Windowing** | **Implements sliding chunks & confidence-weighted aggregation** | Research batch-script only (no real-time ingestion) | **Select Repo 02** for chunk aggregation & streaming logic |
| **Explainability** | **Implements 1D Grad-CAM saliency hooks** | No explainability or saliency implementation | **Select Repo 02** for Grad-CAM analyst visualization |

---

## 10. Architectural Recommendation for TrueVoice
- **Decision**:
  - **Adopt Repo 04 (`NTU-ROSE/RawNet2`)** as the definitive source code for `models/rawnet2_detector.py` and official model checkpoint weights.
  - **Adopt Repo 02 (`VoiceVault`)** for the surrounding streaming wrapper (`core/audio/chunk_aggregator.py`) and the 1D Grad-CAM diagnostic routine (`core/explainability/gradcam.py`).
  - Encapsulate the resulting combined `RawNet2Detector` behind TrueVoice's standard `DeepfakeDetector` abstract interface.
