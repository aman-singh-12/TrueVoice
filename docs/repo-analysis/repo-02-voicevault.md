# Repository Analysis 02: snehalogic / VoiceVault

## 1. Executive Summary & Purpose
- **Repository**: `snehalogic/VoiceVault`
- **Primary Domain**: Real-time voice deepfake detection with chunk-level processing and explainability.
- **Purpose**: Implements a streaming voice deepfake detection architecture using a modified RawNet2 backbone. Demonstrates how continuous speech is divided into sliding chunks, processed through deepfake feature extractors, aggregated across time using confidence weighting, and interpreted using Grad-CAM saliency heatmaps.
- **Architectural Fit**: Maps directly to TrueVoice **Branch 1 (Acoustic Integrity & Artifact Detection)**: providing foundational reference for sliding chunk windowing, temporal confidence-weighted score aggregation, and raw-audio Grad-CAM explainability hooks for security analysts.

---

## 2. Relevant Capability
- **Sliding Window Chunking**: Slicing incoming audio streams into overlapping temporal segments ($3.0\text{s}$ to $4.0\text{s}$ with $50\%$ overlap) suitable for raw waveform architectures.
- **Confidence-Weighted Temporal Aggregation**: Aggregating rolling chunk anomaly scores using statistical confidence weights rather than naive mean averaging, mitigating false positives triggered by transient silence or background noise.
- **Grad-CAM Saliency Visualization**: Computing gradient-weighted class activation maps across 1D convolutional layers to visualize which temporal or frequency regions provoked synthetic voice suspicion.

---

## 3. Potential TrueVoice Components
| TrueVoice Module | Extracted / Referenced Capability | Architectural Role |
| :--- | :--- | :--- |
| `core.audio.chunk_aggregator` | `ConfidenceWeightedAggregator` | Temporal smoothing of chunk predictions across sliding windows |
| `models.rawnet2_detector` | RawNet2 inference pipeline reference | Alternative / candidate raw waveform detector (Branch 1) |
| `core.explainability.gradcam` | 1D Grad-CAM saliency mapping | Generating visual artifact heatmaps for analyst dashboard |

---

## 4. Reusable Code & Implementations
- **Temporal Score Aggregator**:
  - Exponential moving average (EMA) combined with confidence variance weighting:
    $$S_{\text{agg}}(t) = \frac{\sum_{i=1}^{N} w_i \cdot s_i}{\sum_{i=1}^{N} w_i}, \quad w_i = \text{softmax}\left(\frac{|s_i - 0.5|}{\tau}\right)$$
  - Prevents single-frame glitches from tripping critical alerts.
- **Grad-CAM Hook on 1D Convolutions**:
  - PyTorch forward and backward hooks attached to the final convolutional residual block of the raw audio encoder to extract activation gradients.

---

## 5. Reusable Model Checkpoints
- **RawNet2 Fork Checkpoint**: PyTorch model weights fine-tuned for deepfake classification on ASVspoof-derived data.
- **Input Specifications**: Single-channel 16 kHz raw audio waveforms (64,000 samples for 4.0-second chunk).
- **Inference Latency Profile**: ~18–30 ms on GPU; ~55–85 ms on modern multi-core CPU.

---

## 6. Datasets Used
- Evaluated on ASVspoof 2019 Logical Access (LA) evaluation partitions and synthetically generated benchmark test sets.

---

## 7. License & Compliance Audit
- **License**: MIT License / Open Source.
- **Modification Allowed**: Yes.
- **Commercial / Competition Use Allowed**: Yes, subject to attribution.
- **Patent / Restriction Clauses**: None.
- **Redistribution Stance**: Fully compatible with TrueVoice's codebase and open SIH submission guidelines.

---

## 8. Dependencies & Environment
- `torch >= 2.0.0`
- `torchaudio >= 2.0.0`
- `numpy >= 1.24.0`
- `matplotlib >= 3.7.0` (for Grad-CAM rendering)
- `scipy >= 1.10.0`

---

## 9. Risks & Limitations
1. **Architectural Deviation from Canonical RawNet2**: VoiceVault contains minor custom architectural deviations from official NTU-ROSE RawNet2 (altered channel dimensions, differing filter bank scales). Directly mixing weights between the two causes dimension mismatches.
2. **Grad-CAM In-Memory Overhead**: Generating Grad-CAM heatmaps for every streaming chunk induces significant compute overhead (~2.5× baseline inference latency). Must be triggered on-demand or only when risk exceeds the Warning threshold ($S_{\text{risk}} \ge 60$).
3. **Fixed Window Length Assumption**: The chunking routine assumes static 4.0-second lengths; TrueVoice requires dynamic handling of $1.0\text{s}$ to $4.0\text{s}$ audio chunks.

---

## 10. Architectural Recommendation for TrueVoice
- **Extract & Adapt**:
  - Extract the **temporal confidence-weighted aggregation algorithm** into `core.audio.chunk_aggregator` to stabilize streaming risk scores.
  - Implement the **1D Grad-CAM hook** in `core.explainability` as an optional diagnostic trigger (invoked only when risk $\ge 60$ or requested by an analyst).
  - Do NOT adopt VoiceVault's custom RawNet2 definition as the canonical model; instead, adopt the official `NTU-ROSE/RawNet2` definition for model weights and use VoiceVault's chunk aggregation wrapper around it.
