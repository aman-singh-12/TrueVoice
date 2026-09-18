# Repository Analysis 01: Tejahudson / voice-cloning-detector

## 1. Executive Summary & Purpose
- **Repository**: `Tejahudson/voice-cloning-detector`
- **Primary Domain**: AI voice cloning detection and streaming acoustic signal analysis.
- **Purpose**: Provides an end-to-end prototype for classifying audio clips as authentic or synthetically cloned using a fine-tuned self-supervised speech representation model (Wav2Vec 2.0) combined with classical digital signal processing (DSP) acoustic measurements.
- **Architectural Fit**: Maps directly to TrueVoice **Branch 1 (Acoustic Integrity & Artifact Detection)**: providing foundational reference implementations for the Wav2Vec2 inference wrapper, acoustic DSP feature extraction (pitch, jitter, shimmer, HNR), and circular audio buffer management.

---

## 2. Relevant Capability
- **Self-Supervised Feature Classification**: Fine-tuned `facebook/wav2vec2-base` or `wav2vec2-large` sequence classification head for binary deepfake detection (synthetic vs. authentic).
- **Classical DSP Forensic Extraction**:
  - Fundamental frequency ($F_0$) tracking across frames.
  - Jitter (local, absolute, rap) measuring short-term cycle-to-cycle pitch variability.
  - Shimmer (local, apq3, apq5) measuring short-term cycle-to-cycle amplitude variability.
  - Harmonics-to-Noise Ratio (HNR) measuring vocal tract acoustic turbulence and breathiness.
- **Streaming Ingestion**: Circular in-memory audio ring buffer for slicing rolling temporal frames from continuous PCM streams.

---

## 3. Potential TrueVoice Components
| TrueVoice Module | Extracted / Referenced Capability | Architectural Role |
| :--- | :--- | :--- |
| `core.audio.ring_buffer` | `AudioRingBuffer` circular sliding window | Buffering raw 16kHz PCM chunks for Branch 1 & Branch 2 |
| `models.wav2vec2_detector` | `Wav2Vec2ForSequenceClassification` wrapper | Deep learning synthetic voice artifact detection (Branch 1) |
| `core.dsp.forensics` | `AcousticFeatureExtractor` (F0, Jitter, Shimmer, HNR) | Deterministic mathematical artifact detection (Branch 1) |

---

## 4. Reusable Code & Implementations
- **DSP Extraction Logic**: Python routines utilizing `librosa` and `praat-parselmouth` / `scipy.signal` for deterministic acoustic metrics.
  - Pitch estimation using normalized cross-correlation / Yin algorithm.
  - Cycle perturbation calculations for jitter and shimmer.
  - Periodic-to-aperiodic energy ratio calculation for HNR.
- **Ring Buffer Logic**: In-memory numpy array slice manipulation with circular write head and zero-copy slicing for real-time inference windows.

---

## 5. Reusable Model Checkpoints
- **Wav2Vec 2.0 Binary Classifier**: Hugging Face-compatible PyTorch checkpoint fine-tuned on voice cloning datasets.
- **Input Specifications**: Single-channel 16 kHz mono PCM float32 tensors, normalized to $[-1.0, +1.0]$.
- **Inference Latency Profile**: ~35–55 ms on modern GPU (T4/RTX 4090) for 1-second chunks; ~140–210 ms on 4-core x86 CPU.

---

## 6. Datasets Used
- Trained/evaluated primarily on synthetic speech benchmarks (combinations of ASVspoof 2019/2021 Logical Access subsets and proprietary voice cloning samples generated via ElevenLabs / Bark / Tortoise).

---

## 7. License & Compliance Audit
- **License**: MIT License (Permissive).
- **Modification Allowed**: Yes.
- **Commercial / Competition Use Allowed**: Yes, subject to standard copyright attribution notice.
- **Patent / Restriction Clauses**: None.
- **Redistribution Stance**: Fully compatible with TrueVoice's codebase and open SIH submission guidelines.

---

## 8. Dependencies & Environment
- `torch >= 2.0.0`
- `torchaudio >= 2.0.0`
- `transformers >= 4.30.0`
- `librosa >= 0.10.0`
- `praat-parselmouth >= 0.4.3`
- `numpy >= 1.24.0`
- `scipy >= 1.10.0`

---

## 9. Risks & Limitations
1. **CPU Inference Overhead**: Full Wav2Vec2 models have ~95M–317M parameters. CPU execution can exceed 150 ms latency per 1s chunk without FP16 / ONNX Runtime quantization.
2. **Praat-Parselmouth Overhead**: Native C++ Praat wrappers can block Python's GIL if executed synchronously inside the main audio receiving loop.
3. **Overfitting to Known Synthesizers**: Wav2Vec2 representations fine-tuned on single generators exhibit severe performance drop on unseen diffusion or autoregressive vocoders.

---

## 10. Architectural Recommendation for TrueVoice
- **Extract & Adapt**:
  - Encapsulate the Wav2Vec2 classifier behind the TrueVoice standard `DeepfakeDetector` base class.
  - Offload the DSP extraction routines (`praat-parselmouth` / `librosa`) into asynchronous worker threads or ProcessPool workers to prevent blocking the WebSocket event loop.
  - Combine Wav2Vec2 anomaly scores with deterministic DSP forensic thresholds ($HNR < 15 \text{ dB}$, Jitter $< 0.2\%$, Shimmer $< 1.5\%$) inside the Risk Engine rather than relying on Wav2Vec2 alone.
