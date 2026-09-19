# TrueVoice — Speaker Verification & ASR Architecture

**Identity Verification (ECAPA-TDNN) & Conversational Transcription (faster-whisper)**  
**Branch:** `feature/speaker-asr` (Person 2 Responsibility)  
**Target Environment:** Production MVP / SIH 2026 Innovation Challenge  

---

## 1. Executive Summary & Scope

In the TrueVoice two-branch architecture:
- **Branch 1 (Acoustic Integrity)** evaluates synthetic artifacts (neural vocoder anomalies, spectral phase inconsistencies).
- **Branch 2 (Identity & Conversational Context)** is owned by Person 2. It performs:
  1. **Voice Biometrics**: Verifying whether the incoming speaker matches an enrolled identity profile using **SpeechBrain ECAPA-TDNN**.
  2. **Speech Recognition**: Transcribing live audio chunks into high-fidelity text with token log-probabilities using **faster-whisper** (CTranslate2).

```text
Incoming 16 kHz Mono Audio Chunk
               │
       ┌───────┴────────────────────────┐
       │                                │
       ▼                                ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│  ECAPA-TDNN Biometric Branch │ │     faster-whisper ASR       │
│  - SpeechBrain ECAPA Model   │ │  - CTranslate2 INT8/FP16     │
│  - 192-d Embedding Extraction│ │  - Multilingual Auto-Detect  │
│  - Unit L2 Normalization     │ │  - Token Log-Prob Extraction │
│  - Multi-Sample Centroid     │ │  - Privacy/Redacted Logging  │
└──────────────┬───────────────┘ └──────────────┬───────────────┘
               │                                │
               ▼                                ▼
   SpeakerVerificationResult                ASRResult
   (similarity, threshold,                (transcript, confidence,
    verified, confidence)                  language, duration)
```

---

## 2. PART A: ECAPA-TDNN Speaker Verification

### 2.1 Model Architecture
TrueVoice adopts the **SpeechBrain ECAPA-TDNN** (Emphasized Channel Attention, Propagation and Aggregation Time Delay Neural Network) trained on VoxCeleb 1 & 2 (`speechbrain/spkrec-ecapa-voxceleb`):
- **1D Squeeze-and-Excitation (SE-Res2Net)** blocks with multi-scale dilation.
- **Attentive Statistics Pooling (ASP)** capturing global speaker characteristics.
- **Dimensionality**: Outputs a dense, unit-normalized **192-dimensional** embedding vector ($e \in \mathbb{R}^{192}$).

### 2.2 Mathematical Formulations

#### Individual Embedding Normalization
For any audio segment $x$, the raw embedding $v = \text{ECAPA}(x)$ is mapped to the unit hypersphere:
$$\hat{e} = \frac{v}{\|v\|_2 + \epsilon}, \quad \epsilon = 10^{-9}$$

#### Multi-Sample Centroid Enrollment
When enrolling an authorized identity (e.g., an executive or authenticated user), TrueVoice accepts $M \ge 1$ audio samples. Each sample is validated for minimum duration ($\ge 0.25\text{s}$) and non-trivial energy before feature extraction:
$$\mu = \frac{1}{M} \sum_{i=1}^M \hat{e}_i, \qquad c = \frac{\mu}{\|\mu\|_2 + \epsilon}$$
Only the unit centroid $c \in \mathbb{R}^{192}$ is persisted to the database (`voiceprint_embeddings` table via PostgreSQL `pgvector`); raw enrollment audio is discarded unless explicitly retained.

#### Cosine & Normalized Geometric Similarity
For a live chunk embedding $e_{\text{live}}$ and enrolled centroid $c$:
$$\text{CosineSim}(e_{\text{live}}, c) = e_{\text{live}} \cdot c \in [-1.0, 1.0]$$
To integrate linearly with TrueVoice's risk engine, the cosine similarity is transformed into normalized geometric similarity:
$$S_{\text{speaker}} = \frac{\text{CosineSim}(e_{\text{live}}, c) + 1.0}{2.0} \in [0.0, 1.0]$$

#### Configurable Operational Threshold
A speaker is declared verified when:
$$\text{verified} = (S_{\text{speaker}} \ge \tau_{\text{speaker}})$$
- Default configuration: `TRUEVOICE_SPEAKER_THRESHOLD = 0.75` (equivalent to $\text{CosineSim} \ge 0.50$).
- **Calibration Stance**: TrueVoice documents $\tau_{\text{speaker}}$ as a **configurable operational operating point** tailored to organizational risk appetite. It is not represented as an empirical universal EER constant without dataset-specific calibration.

### 2.3 Zero-Fake-Data Guarantee
In production mode (`TRUEVOICE_ML_MODE=live`):
- If SpeechBrain weights or dependencies are missing, `ECAPASpeakerVerifier` raises `ModelUnavailableError` during enrollment and returns `SignalAvailability.UNAVAILABLE` with `verified=None, similarity=None` during verification.
- Under **no circumstances** does production code generate FFT-derived vectors or fabricate identity matches.
- Deterministic mock fixtures exist solely in `MockSpeakerVerifier` and are explicitly tagged `# TEST-ONLY FIXTURE`.

---

## 3. PART B: faster-whisper Automatic Speech Recognition

### 3.1 Inference Engine
TrueVoice employs `faster-whisper`, a reimplementation of OpenAI's Whisper model utilizing **CTranslate2** for fast transformer inference:
- **Quantization & Efficiency**: Default `compute_type="int8"` on CPU yields $\approx 4\times$ throughput speedup compared to standard PyTorch Whisper, with minimal loss in word error rate.
- **Configurable Model Sizes**: Configured via `TRUEVOICE_ASR_MODEL` (`tiny`, `base`, `small`, `medium`, `large-v3`; default `small`).
- **Hardware Agnostic**: Runs natively on standard CPUs; automatically activates CUDA with `compute_type="float16"` when configured (`TRUEVOICE_ASR_DEVICE="cuda"`).

### 3.2 Multilingual Capabilities
- **Language Selection**: Controlled via `TRUEVOICE_ASR_LANGUAGE`.
- **Dynamic Auto-Detection**: When set to `None`, the model analyzes the first 30 seconds of audio and detects the spoken language automatically.
- **Target Locales**:
  - **English (`en`)**
  - **Hindi (`hi`)**
  - **Punjabi (`pa`)**
  - **Code-Switched (Hinglish/Punglish)**: Transcribed phonetically into the dominant script without pipeline crashes.

### 3.3 Confidence & Token Log-Probabilities
Each transcribed segment outputs an average log-probability $\overline{\log p} \le 0$:
$$\text{Confidence} = \exp\left(\frac{1}{K} \sum_{k=1}^K \log p_k\right) \in [0.0, 1.0]$$
The per-token log probabilities are returned in `ASRResult.token_log_probs` for downstream phonetic consistency analysis.

### 3.4 Privacy & Redacted Logging
In accordance with TrueVoice cybersecurity standards:
- Raw audio buffers are never emitted to log aggregators.
- Live transcripts are redacted/truncated in operational log streams (first 25 characters only).

---

## 4. Configuration Reference

| Environment Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `TRUEVOICE_ML_MODE` | `str` | `"mock"` | `"live"` for real SpeechBrain/Whisper; `"mock"` for test fixtures. |
| `TRUEVOICE_SPEAKER_THRESHOLD` | `float` | `0.75` | Configurable operating point for geometric similarity in $[0.0, 1.0]$. |
| `TRUEVOICE_SPEAKER_DEVICE` | `str` | `"cpu"` | Target compute device for ECAPA (`"cpu"` or `"cuda"`). |
| `SPEAKER_MODEL_SOURCE` | `str` | `"speechbrain/spkrec-ecapa-voxceleb"` | Hugging Face repository or local path for ECAPA weights. |
| `TRUEVOICE_ASR_MODEL` | `str` | `"small"` | Whisper model size (`tiny`, `base`, `small`, `medium`, `large-v3`). |
| `TRUEVOICE_ASR_DEVICE` | `str` | `"cpu"` | Compute device for ASR (`"cpu"` or `"cuda"`). |
| `TRUEVOICE_ASR_COMPUTE_TYPE` | `str` | `"int8"` | CTranslate2 quantization (`"int8"`, `"float16"`, `"float32"`). |
| `TRUEVOICE_ASR_LANGUAGE` | `str` | `None` | Language code (`"en"`, `"hi"`, `"pa"`) or `None` for auto-detect. |
| `TRUEVOICE_ASR_BEAM_SIZE` | `int` | `5` | Beam search decoding width. |

---

## 5. Licensing & Intellectual Property Compliance

1. **SpeechBrain (`speechbrain/spkrec-ecapa-voxceleb`)**:
   - **License**: Apache License 2.0.
   - **Attribution**: *Ravanelli et al., "SpeechBrain: A General-Purpose Speech Toolkit", arXiv 2021.*
   - **Status**: Permissive, commercially compliant.
2. **ECAPA-TDNN Architecture**:
   - **License**: Apache License 2.0.
   - **Attribution**: *Desplanques, Thienpondt, & Demuynck, "ECAPA-TDNN: Emphasized Channel Attention, Propagation and Aggregation in TDNN Based Speaker Verification", Interspeech 2020.*
   - **Status**: Permissive.
3. **faster-whisper**:
   - **License**: MIT License.
   - **Attribution**: *Guillaume Klein, SYSTRAN, faster-whisper CTranslate2 implementation.*
   - **Status**: Permissive.
4. **VCFAD Conceptual Insight (`pk9444/2xqcTCqAYvy0SJbK`)**:
   - **Status**: Unlicensed third-party repository. **Zero code copied**.
   - **Conceptual Adoption**: The analytical concept that synthetic speech exhibits measurable token log-probability and phonetic confidence degradation is implemented independently using native `faster-whisper` token metadata.
