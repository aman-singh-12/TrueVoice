# TrueVoice — Backend Viva & Defense Preparation Audit

**Target Audience:** Engineering Candidates defending the TrueVoice System Architecture and Implementation in a Technical Viva / Panel Review.  
**Repository Working Directory:** `C:\Projects\SIH`  
**Current Active Branch:** `integration/truevoice-final`  
**Verification Baseline:** 109 automated tests passing, 2 skipped (100% test pass rate in mock-mode CI).

---

## 1. REPOSITORY DISCOVERY & COMPONENT MAP

### Branch & Working Tree State
- **Branch:** `integration/truevoice-final` (integrated across all 5 branches: `feature/ml-detection`, `feature/speaker-asr`, `feature/risk-intelligence`, `feature/realtime-platform`, `feature/benchmark-security`).
- **Working Tree:** Clean, synchronized with remote `origin/integration/truevoice-final`.

### Actual Component Architecture Map

```text
Incoming Audio (Browser / SIP / Gateway)
      │
      ▼
1. Transport Layer (`/v1/stream/{session_id}`)
      │ [WebSocket Route, JWT Session-Ticket Auth, 64KB Frame Limit, Heartbeat PING/PONG]
      ▼
2. Audio Pipeline Ingest (`app.audio.pipeline.AudioPipeline`)
      │ [Decode PCM16 LE -> Polyphase Resample to 16kHz -> Energy VAD -> Circular Buffer]
      ▼
3. Circular Buffer Windowing (`app.audio.buffer.CircularAudioBuffer`)
      │ [Capacity: 10s (160,000 samples). Triggers when 2.0s window full & 0.5s hop accumulated]
      │ Synchronized Two-Branch Extraction: (ml_chunk, forensic_chunk)
      │
      ├─── BRANCH 1: Real-Time Deepfake Detection (`app.detectors.registry.DetectorRegistry`)
      │      ├── Primary: Wav2Vec2 (`app.detectors.wav2vec2.detector.Wav2Vec2Detector`)
      │      ├── Candidates: RawNet2 (`app.detectors.rawnet2.detector.RawNet2Detector`)
      │      ├── Candidates: AASIST (`app.detectors.aasist.detector.AASISTDetector`)
      │      ├── Multi-Model Ensemble (`app.detectors.ensemble.detector.EnsembleDetector`)
      │      └── Test Fixture: Mock (`app.detectors.mock.MockDeepfakeDetector`)
      │           └── Output: `DeepfakeResult(score, label, confidence, signal_availability)`
      │
      ├─── BRANCH 2A: Biometric Speaker Verification (`app.speaker.factory.get_speaker_verifier`)
      │      ├── Production: ECAPA-TDNN (`app.speaker.ecapa.verifier.ECAPASpeakerVerifier`)
      │      └── Test Fixture: Mock (`app.speaker.mock.MockSpeakerVerifier`)
      │           └── Output: `VerificationResult(similarity, distance, is_match, verified)`
      │
      ├─── BRANCH 2B: Automatic Speech Recognition (`app.asr.factory.get_speech_recognizer`)
      │      ├── Production: Faster-Whisper (`app.asr.whisper.WhisperSpeechRecognizer`)
      │      └── Test Fixture: Mock (`app.asr.mock.MockSpeechRecognizer`)
      │           └── Output: `ASRResult(transcript, confidence, language, signal_availability)`
      │
      └─── BRANCH 2C: Deterministic DSP Forensics (`app.forensics.analyzer.ForensicAnalyzer`)
             ├── 12 Physical Signal Measurements (F0, Jitter, Shimmer, HNR, Spectral, Energy)
             └── Output: `ForensicResult(score, features, evidence, signal_availability)`
      │
      ▼ (Asynchronous Concurrent Join: `asyncio.gather`)
4. Conversational Intent & Context Intelligence
      ├── Intent Analysis (`app.intelligence.intent.IntentAnalyzer`):
      │     └── 9 Threat Categories, Multi-Indicator Compounding, Defensive Speech Suppression
      └── Context Intelligence (`app.intelligence.context.ContextEngine`):
            └── 8 Operational Signals (Transaction Amount, Channel, Off-Hours, Beneficiary, etc.)
      │
      ▼
5. Multi-Signal Mathematical Risk Fusion (`app.risk.fusion.MultiSignalRiskFusion`)
      │ Dynamic Weight Renormalization across active signals:
      │ Weights: Deepfake (0.35), Speaker (0.25), Context (0.15), Intent (0.15), Forensic (0.10)
      │ Non-linear Compounding Multiplier: Gamma = 1.35 for corroborated critical anomalies
      │ Output: Raw Normalized Security Risk Score R_raw in [0.0, 100.0]
      ▼
6. Temporal Smoothing (`app.risk.engine.SessionRiskEngine`)
      │ Asymmetric Exponential Moving Average (EMA):
      │ - Attack Alpha (escalation): 0.60
      │ - Decay Alpha (recovery): 0.20
      │ Output: Smoothed Composite Risk R_smoothed in [0.0, 100.0], RiskTier (LOW, MODERATE, HIGH, CRITICAL)
      ▼
7. Declarative Policy Engine (`app.policy.engine.DeclarativePolicyEngine`)
      │ Policy Decision Point (PDP) evaluating Risk + Intent + Biometrics + Context
      │ Invariant: High deepfake ALONE with verified speaker does NOT trigger instant BLOCK
      │ Dual Confirmation Anomaly Gate: Requires synthetic voice + (mismatch OR threat)
      │ Output: `PolicyEvaluationResult(action, target_trust_state, rule_matched, reason)`
      ▼
8. Zero-Trust State Machine (`app.policy.state_machine.ZeroTrustStateMachine`)
      │ States: OBSERVING -> CAUTION -> VERIFYING -> TRUSTED -> RESTRICTED -> BLOCKED -> TERMINATED
      │ Enforces valid transitions and human analyst review override gates
      ▼
9. Cryptographic Audit & Telemetry
      ├── Tamper-Evident SHA-256 Hash Chain (`app.audit.chain.AuditLedgerChainer`):
      │     └── H_n = SHA256(H_(n-1) || CanonicalJSON(Event_n))
      └── Telemetry Broadcast: Sent back over WebSocket (`RiskTelemetryBroadcast`)
```

---

## 2. BACKEND TECHNOLOGY STACK

| Component | Actual Technology in Code | File / Module | Purpose |
| :--- | :--- | :--- | :--- |
| **API Framework** | FastAPI `>=0.110.0`, Starlette | [`backend/app/main.py`](file:///c:/Projects/SIH/backend/app/main.py) | High-performance asynchronous REST API routing, OpenAPI documentation, and dependency injection. |
| **WebSocket** | Starlette WebSockets (`websockets>=12.0`) | [`backend/app/api/websocket/audio_stream.py`](file:///c:/Projects/SIH/backend/app/api/websocket/audio_stream.py) | Full-duplex streaming for real-time binary PCM chunk ingestion and JSON telemetry frame broadcasts. |
| **Database** | PostgreSQL 16 + `pgvector` (production) / SQLite via `aiosqlite` (tests) | [`backend/app/db/session.py`](file:///c:/Projects/SIH/backend/app/db/session.py) | Relational persistence for tenants, users, sessions, risk assessments, audit logs, and 192-d voice embeddings. |
| **ORM & Migrations** | SQLAlchemy 2.0 (AsyncIO) + Alembic `>=1.13.1` | [`backend/app/models/`](file:///c:/Projects/SIH/backend/app/models/), `backend/alembic/` | Declarative asynchronous ORM mapping, connection pooling, and schema migration tracking. |
| **Deepfake ML** | PyTorch `>=2.2.0`, HuggingFace `transformers>=4.38.0`, SincNet | [`backend/app/detectors/`](file:///c:/Projects/SIH/backend/app/detectors/) | Fine-tuned Wav2Vec 2.0 sequence classification; canonical RawNet2 and AASIST neural graph architectures. |
| **Speaker Model** | SpeechBrain `>=1.0.0` / PyTorch (ECAPA-TDNN) | [`backend/app/speaker/ecapa/verifier.py`](file:///c:/Projects/SIH/backend/app/speaker/ecapa/verifier.py) | 192-dimensional speaker embedding extraction and geometric cosine similarity against enrolled centroid. |
| **ASR Engine** | `faster-whisper>=1.0.0` (CTranslate2 backend) | [`backend/app/asr/whisper.py`](file:///c:/Projects/SIH/backend/app/asr/whisper.py) | Low-latency quantized INT8/FP16 streaming speech-to-text with auto-language detection. |
| **DSP & Math** | NumPy `>=1.26.0`, SciPy `>=1.12.0` | [`backend/app/forensics/`](file:///c:/Projects/SIH/backend/app/forensics/), [`backend/app/audio/`](file:///c:/Projects/SIH/backend/app/audio/) | Polyphase FIR resampling, FFT, autocorrelation, parabolic interpolation, energy and spectral feature extraction. |
| **Risk Engine** | Pure NumPy & Python Mathematical Engine | [`backend/app/risk/fusion.py`](file:///c:/Projects/SIH/backend/app/risk/fusion.py), [`backend/app/risk/engine.py`](file:///c:/Projects/SIH/backend/app/risk/engine.py) | Dynamic weight renormalization, non-linear compounding multiplier ($\Gamma=1.35$), and asymmetric EMA smoothing. |
| **Policy Engine** | Declarative Python PDP + Finite State Machine | [`backend/app/policy/engine.py`](file:///c:/Projects/SIH/backend/app/policy/engine.py), [`backend/app/policy/state_machine.py`](file:///c:/Projects/SIH/backend/app/policy/state_machine.py) | Zero-trust policy evaluation, multi-signal threshold checking, transaction hold enforcement, state transitions. |
| **Audit System** | Cryptographic SHA-256 Hash Chaining | [`backend/app/audit/chain.py`](file:///c:/Projects/SIH/backend/app/audit/chain.py) | Sequential cryptographic linking of audit records with genesis anchor and canonical JSON serialization. |
| **Authentication** | `python-jose` (JWT with HS256), `bcrypt` | [`backend/app/core/security.py`](file:///c:/Projects/SIH/backend/app/core/security.py) | Multi-tenant bearer tokens, password hashing, and ultra-short-lived (5 min) single-use session-scoped tickets. |

---

## 3. COMPLETE BACKEND DATA FLOW (TRACE OF A SINGLE AUDIO CHUNK)

Here is the exact trace of an incoming audio frame from client transmission to live dashboard update:

```text
[Client Microphone]
      │ (Raw PCM16 binary chunks over WebSocket)
      ▼
1. API Route: `backend/app/api/websocket/audio_stream.py`
   Function: `websocket_audio_stream(websocket, session_id, token)`
   Input: Binary frame `raw_chunk` (bytes). Enforces 64KB upper boundary (`len <= 65536`).
   Processing: Rejects frames > 64KB with WS close code 1009. Checks session-ticket token validity.
   Next Component: `AudioService.process_audio_chunk`

2. Service Orchestration: `backend/app/services/audio_service.py`
   Class: `AudioService`
   Function: `process_audio_chunk(session, raw_audio_bytes, source_sample_rate, db)`
   Input: `bytes`, `source_sample_rate` (e.g. 48000Hz or 16000Hz).
   Processing: Retrieves session's circular buffer pipeline and risk engine.
   Next Component: `AudioPipeline.process_incoming_chunk`

3. Ingestion & Preprocessing: `backend/app/audio/pipeline.py`
   Class: `AudioPipeline`
   Function: `process_incoming_chunk(raw_bytes, source_sample_rate)`
   Processing Steps:
     a. Decoding: `app.audio.decoder.decode_pcm16_le` -> converts bytes to `np.float32` in `[-1.0, 1.0]`.
     b. Resampling: `app.audio.resampler.AudioResampler.resample` -> converts source rate to canonical 16kHz using `scipy.signal.resample_poly`.
     c. VAD Check: `app.audio.vad.VoiceActivityDetector.is_speech` -> computes RMS dBFS against `-45 dBFS` floor.
     d. Buffer Write: `app.audio.buffer.CircularAudioBuffer.write` -> writes into 10-second ring buffer.
   Window Extraction: `extract_analysis_window()` checks if `samples_since_last_hop >= 8000` (0.5s) AND `available_samples >= 32000` (2.0s).
   Output: If hop ready, returns tuple `(ml_chunk, forensic_chunk)`. Otherwise returns `None` to wait for accumulation.

4. Concurrent Multi-Branch Analysis: `backend/app/services/audio_service.py:122-153`
   Executed concurrently using `asyncio.gather`:
   - Branch 1 (Deepfake): `primary_detector.predict(ml_chunk, 16000)`
       File: `backend/app/detectors/wav2vec2/detector.py`
       Algorithm: Wav2Vec 2.0 feature extractor + sequence classification head.
       Output: `DeepfakeResult(score=78.5, label="SYNTHETIC", confidence=0.88)`
   - Branch 2A (Speaker): `speaker_verifier.verify(ml_chunk, enrolled_embedding, 16000)`
       File: `backend/app/speaker/ecapa/verifier.py`
       Algorithm: SpeechBrain ECAPA-TDNN 192-d embedding extraction, cosine similarity.
       Output: `VerificationResult(similarity=0.42, verified=False, distance=0.58)`
   - Branch 2B (Forensics): `asyncio.to_thread(forensic_analyzer.analyze, forensic_chunk, 16000)`
       File: `backend/app/forensics/analyzer.py`
       Algorithm: Deterministic acoustic DSP (autocorrelation F0, local jitter, shimmer, HNR, spectral centroid/rolloff).
       Output: `ForensicResult(score=65.0, features={...}, evidence=[...])`
   - Branch 2C (ASR): `speech_recognizer.transcribe(ml_chunk, 16000)`
       File: `backend/app/asr/whisper.py`
       Algorithm: Faster-Whisper INT8 beam search transcription.
       Output: `ASRResult(transcript="wire the funds immediately, do not call me back", language="en")`

5. Conversational & Contextual Intelligence: `backend/app/services/audio_service.py:155-166`
   - Intent Analysis: `app.intelligence.intent.IntentAnalyzer.evaluate(transcript)`
       Algorithm: Pattern scanning across 9 threat categories with multi-indicator compounding and defensive speech negation.
       Output: `s_conv = 0.78`, detected intents: `["FINANCIAL_URGENCY", "CALLBACK_SUPPRESSION"]`.
   - Context Engine: `app.intelligence.context.ContextEngine.evaluate(request_context, session_context)`
       Algorithm: Extraction of 8 operational context signals against tenant policy thresholds.
       Output: `ContextResult(score=0.45, risk_factors=["High-value transaction", "Unusual channel"])`.

6. Multi-Signal Mathematical Fusion: `backend/app/risk/fusion.py`
   Class: `MultiSignalRiskFusion`
   Function: `fuse(...)`
   Processing: Normalizes active signals to `[0.0, 1.0]`, renormalizes base weights across available signals, computes linear weighted sum, checks compounding conditions (synthetic >= 70 AND corroborated mismatch/threat -> multiply by 1.35).
   Output: `r_raw = 82.4`, `normalized_weights = {...}`, `has_compounding = True`.

7. Temporal Smoothing: `backend/app/risk/engine.py`
   Class: `SessionRiskEngine`
   Function: `evaluate_chunk(...)`
   Processing: Compares `r_raw` to `previous_smoothed_score`. Escalates rapidly with `alpha_attack = 0.60`.
   Calculation: `r_smoothed = 0.60 * 82.4 + 0.40 * 40.0 = 65.44`. Updates peak risk. Classifies `RiskTier.HIGH`.
   Output: Telemetry dictionary with composite risk, risk tier, primary factors, and evidence provenance.

8. Policy Evaluation & Action: `backend/app/policy/engine.py`
   Class: `DeclarativePolicyEngine`
   Function: `evaluate(...)`
   Processing: Evaluates rules deterministically. Checks mitigation invariant (is speaker verified?). Because speaker mismatch is present and threat is detected, evaluates high-risk step-up rule.
   Output: `PolicyEvaluationResult(action=SecurityActionType.REQUEST_VERIFICATION, target_trust_state=TrustState.VERIFYING, rule_matched="RULE_HIGH_RISK_STEP_UP_VERIFY")`.

9. State Machine Enforcement: `backend/app/services/policy_service.py`
   Class: `ZeroTrustStateMachine`
   Function: `transition_to(TrustState.VERIFYING)`
   Processing: Validates state transition from `OBSERVING -> VERIFYING` via `VALID_TRANSITIONS` table. Updates session trust state in database.

10. Database Persistence & Audit Ledger: `backend/app/services/risk_service.py` & `backend/app/audit/chain.py`
    - Persists `RiskAssessment` row with all signal scores and provenance.
    - Appends event to `AuditLog` table using `AuditLedgerChainer.compute_hash`:
        `H_n = SHA256(H_(n-1) || CanonicalJSON(Event_n))`

11. Telemetry Delivery: `backend/app/api/websocket/audio_stream.py`
    WebSocket sends JSON string of `RiskTelemetryBroadcast` to browser client.
    Live dashboard UI updates risk gauge, threat badges, and triggers step-up verification modal.
```

---

## 4. AUDIO INPUT SPECIFICATIONS

The TrueVoice audio input parameters are strictly defined in [`backend/app/config.py`](file:///c:/Projects/SIH/backend/app/config.py) and [`backend/app/audio/pipeline.py`](file:///c:/Projects/SIH/backend/app/audio/pipeline.py):

* **Transport Protocol:** Bidirectional WebSocket (`/v1/stream/{session_id}`).
* **Authentication:** Short-lived (5 min) session ticket passed via query param `?token=` or initial JSON `HANDSHAKE` message.
* **Audio Format:** Linear PCM, 16-bit Signed Little-Endian (`pcm_s16le`).
* **Canonical Sample Rate:** `16,000 Hz` (16 kHz).
* **Channels:** `1` (Mono).
* **Bit Depth:** `16 bits` (2 bytes per sample).
* **Frame Boundary Protection:** Strictly capped at `65,536 bytes` (64 KB) per WebSocket message. Frames exceeding 64 KB are rejected immediately with WS close code `1009 (Message Too Big)`.
* **Analysis Window Size:** `2.0 seconds` (`32,000 samples`).
* **Hop Size:** `0.5 seconds` (`8,000 samples`).
* **Circular Buffer Capacity:** `10.0 seconds` (`160,000 samples`).

### Why These Specific Parameters Exist
1. **16 kHz Sample Rate:** Standard acoustic sampling rate for modern speech models (Wav2Vec 2.0, Whisper, ECAPA-TDNN). Captures frequencies up to 8 kHz (Nyquist frequency), covering the human vocal tract formants and pitch range while minimizing memory bandwidth.
2. **2.0s Window / 0.5s Hop:** 2 seconds provides sufficient phonemic context for transformer attention mechanisms and stable F0 pitch tracking without introducing excessive initial latency. The 0.5s hop guarantees smooth rolling updates (2 Hz telemetry refresh).
3. **64 KB Upper Bound:** Protects server memory from denial-of-service (DoS) memory exhaustion attacks via oversized payloads. At 16kHz 16-bit mono (32 KB/s), 64 KB represents 2 full seconds of uncompressed audio in a single frame.

---

## 5. AUDIO PREPROCESSING AUDIT

### 1. Sample-Rate Conversion
- **Algorithm:** Polyphase FIR filter resampling via `scipy.signal.resample_poly`.
- **Implementation:** [`backend/app/audio/resampler.py:AudioResampler`](file:///c:/Projects/SIH/backend/app/audio/resampler.py)
- **Mathematical Details:** Computes greatest common divisor `gcd = math.gcd(source_rate, target_rate)`, calculates integer upsampling factor `up = target_rate // gcd` and downsampling factor `down = source_rate // gcd`, then applies anti-aliasing low-pass polyphase filtering.
- **Clipping Protection:** Hard clamped to `[-1.0, 1.0]` using `np.clip` to eliminate sinc filter ringing overshoots.

### 2. Normalization
- **Circular Buffer Level:** **NO destructive normalization is applied globally.** The circular buffer preserves the raw un-normalized acoustic audio for the Forensic Branch.
- **Model Adapter Level:** Preprocessing is strictly decoupled per model:
  - **Wav2Vec 2.0 (`app.detectors.wav2vec2.detector.py:preprocess`):** Standardized RMS scaling to `-24 dBFS` with a `-1.0 dBFS` peak clamp.
  - **RawNet2 (`app.detectors.rawnet2.detector.py:preprocess`):** First-order high-frequency pre-emphasis filter ($y[t] = x[t] - 0.97 \cdot x[t-1]$) followed by zero-mean unit-variance standardization.
  - **AASIST (`app.detectors.aasist.detector.py:preprocess`):** Peak normalization with DC-offset removal.
  - **Forensic Analyzer (`app.forensics.analyzer.py`):** Operates on the completely raw un-normalized waveform so physical energy and amplitude variations remain untainted.

### 3. Voice Activity Detection (VAD)
- **Current Implementation:** Lightweight Energy & Zero-Crossing Rate VAD in [`backend/app/audio/vad.py:VoiceActivityDetector`](file:///c:/Projects/SIH/backend/app/audio/vad.py).
- **RMS Formula:**
  $$\text{RMS} = \sqrt{\frac{1}{N} \sum_{i=1}^N x[i]^2 + 10^{-12}}$$
  $$\text{RMS}_{\text{dBFS}} = 20 \log_{10}(\text{RMS} + 10^{-12})$$
- **Threshold:** Configurable noise floor threshold defaulting to `-45.0 dBFS`.
- **Behavior on Silence:** If frame is below `-45 dBFS`, `is_speech()` returns `False`. The pipeline logs low-energy frames and prevents miscalibrated inferences from evaluating ambient silence.

---

## 6. DEEPFAKE DETECTION ARCHITECTURES

TrueVoice implements three distinct neural network architectures for deepfake detection, managed dynamically via [`backend/app/detectors/registry.py:DetectorRegistry`](file:///c:/Projects/SIH/backend/app/detectors/registry.py):

| Attribute | Wav2Vec 2.0 Adapter | RawNet2 Model & Adapter | AASIST Model & Adapter |
| :--- | :--- | :--- | :--- |
| **Model Type** | Pretrained Speech Transformer + Classification Head | End-to-End Raw Waveform SincNet + GRU | Spectro-Temporal Graph Attention Network |
| **Upstream Source** | `Tejahudson/voice-cloning-detector` (MIT) | `NTU-ROSE/RawNet2` (Tak et al., MIT) | `clovaai/aasist` (Jung et al., Apache 2.0) |
| **Source File** | `app/detectors/wav2vec2/detector.py` | `app/detectors/rawnet2/model.py` & `detector.py` | `app/detectors/aasist/model.py` & `detector.py` |
| **Input Format** | 16kHz float32 waveform, RMS normalized to -24 dBFS | 16kHz float32 waveform, pre-emphasized ($\alpha=0.97$) | 16kHz float32 waveform, peak normalized |
| **Front-End** | 7-layer temporal convolutional feature encoder | Mel-scale parametric SincNet bandpass filterbank | 70-channel sinc-convolutional filterbank |
| **Back-End** | 12-layer Transformer contextual encoder | Squeeze-and-Excitation residual blocks + Bi-GRU | 2D spectro-temporal ResBlocks + Heterogeneous GAT |
| **Score Meaning** | Synthetic voice probability in `[0.0, 100.0]` | Log-softmax classification probability in `[0.0, 100.0]` | Spoof class posterior probability in `[0.0, 100.0]` |
| **Threshold** | `>= 50.0` flagged as `SYNTHETIC` | `>= 50.0` flagged as `SYNTHETIC` | `>= 50.0` flagged as `SYNTHETIC` |
| **Fallback** | Reports `SignalAvailability.UNAVAILABLE` if no checkpoint | Reports `SignalAvailability.UNAVAILABLE` if no checkpoint | Reports `SignalAvailability.UNAVAILABLE` if no checkpoint |

---

## 7. WAV2VEC 2.0 DEEP DIVE (VIVA DEFENSE)

### Architecture Explanation for Viva
Wav2Vec 2.0 (Baevski et al., Meta AI) processes raw audio through three primary stages:
1. **Feature Encoder:** A 7-layer temporal convolutional neural network (CNN) with GELU activation that downsamples 16kHz raw waveform into multi-channel feature vectors ($Z$) every 20ms (25ms window, 20ms stride).
2. **Contextual Transformer:** A 12-layer Transformer encoder (similar to BERT) with multi-head self-attention that builds contextualized representations ($C$) across the temporal sequence, learning phonemic and acoustic relationships.
3. **Classification Head:** For deepfake detection, a linear classification projection layer is added on top of the mean-pooled transformer representations to output 2 logits: `[authentic_logit, synthetic_logit]`. Softmax produces the probability distribution.

### Implementation Grounding in TrueVoice
- **Checkpoint Requirement:** Specified by environment variable `TRUEVOICE_WAV2VEC2_MODEL`.
- **Honest Viva Distinction:** TrueVoice does NOT use raw generic `facebook/wav2vec2-base` because an uncalibrated base model does not output deepfake predictions. TrueVoice requires an explicitly fine-tuned sequence classification checkpoint (e.g. trained on ASVspoof 2019/2021). If no fine-tuned checkpoint is provided or PyTorch is missing, the adapter cleanly marks the signal as `SignalAvailability.UNAVAILABLE` with score `0.0`. It never fabricates synthetic scores.
- **Why It Detects Deepfakes:** Neural vocoders (HiFi-GAN, WaveGlow, Tacotron) generate subtle phase mismatches and unnatural phoneme transition artifacts. The multi-head self-attention heads capture these long-range temporal inconsistencies that traditional spectrogram CNNs miss.

---

## 8. RAWNET2 DEEP DIVE (VIVA DEFENSE)

### Viva Explanation
- **Core Motivation:** Traditional deepfake detectors use Short-Time Fourier Transform (STFT) spectrograms. STFT discards phase information and enforces a fixed time-frequency resolution trade-off. RawNet2 operates directly on raw waveforms in the time domain.
- **SincNet Filterbank:** Instead of standard CNN filters, RawNet2 uses parametric bandpass filters defined as sinc functions in time domain:
  $$h[n, f_1, f_2] = 2f_2 \frac{\sin(2\pi f_2 n)}{2\pi f_2 n} - 2f_1 \frac{\sin(2\pi f_1 n)}{2\pi f_1 n}$$
  Only two cut-off frequencies ($f_1, f_2$) are learned per filter, initialized along the human mel-frequency scale. This drastically reduces trainable parameters while preserving psychoacoustic boundaries.
- **Residual Blocks with Frequency-wise SE (F-SE):** Residual blocks extract higher-level representations. The Frequency-wise Squeeze-and-Excitation block pools temporal features and applies attention weights across frequency channels, amplifying channels with suspicious synthetic harmonics.
- **Temporal Aggregation:** A Bidirectional GRU aggregates the framed representations across the entire chunk into a single fixed embedding vector for linear classification.
- **Code Implementation Status:** The complete, fully faithful mathematical architecture is implemented in [`backend/app/detectors/rawnet2/model.py`](file:///c:/Projects/SIH/backend/app/detectors/rawnet2/model.py). Inference is executed non-blockingly in a worker thread pool via `asyncio.to_thread`. If no checkpoint weights are supplied via `TRUEVOICE_RAWNET2_MODEL`, it returns `SignalAvailability.UNAVAILABLE`.

---

## 9. AASIST DEEP DIVE (VIVA DEFENSE)

### Viva Explanation
- **AASIST:** *Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention Networks* (Jung et al., Clova AI, Interspeech 2021).
- **Core Innovation:** Treats audio not as an image, but as a heterogeneous graph. A synthetic voice might have authentic temporal rhythm but anomalous high-frequency spectral artifacts, or vice versa.
- **Graph Attention Mechanism:**
  - Constructs a **Spectral Graph** where nodes represent frequency sub-bands.
  - Constructs a **Temporal Graph** where nodes represent time segments.
  - A heterogeneous graph attention layer (GAT) computes dynamic attention coefficients between spectral and temporal nodes, allowing the model to detect subtle cross-domain inconsistencies.
- **Code Implementation Status:** Ported in pure PyTorch (eliminating heavy external `torch_geometric` dependencies) in [`backend/app/detectors/aasist/model.py`](file:///c:/Projects/SIH/backend/app/detectors/aasist/model.py). Controlled via `TRUEVOICE_AASIST_MODEL`.

---

## 10. MODEL COMPARISON MATRIX

| Model | Input Domain | Primary Architecture | Complementary Strength | TrueVoice Runtime Status |
| :--- | :--- | :--- | :--- | :--- |
| **Wav2Vec 2.0** | Time-domain 16kHz audio (normalized to -24 dBFS) | 7-layer CNN + 12-layer Transformer Attention | Captures contextual phonemic transitions and high-level linguistic temporal cues. | **REAL ADAPTER** (runs live with fine-tuned checkpoint; fails to UNAVAILABLE if absent). |
| **RawNet2** | Raw waveform (pre-emphasized $\alpha=0.97$) | SincNet Mel-filterbank + F-SE ResBlocks + Bi-GRU | Operates on raw time-domain waveforms; captures phase distortions without STFT quantization loss. | **REAL ARCHITECTURE** (clean-room PyTorch model; requires checkpoint path). |
| **AASIST** | Raw waveform (peak-normalized) | SincNet frontend + Heterogeneous Graph Attention Networks | Correlates spectral anomalies across disparate temporal intervals using graph attention. | **REAL ARCHITECTURE** (pure PyTorch implementation; requires checkpoint path). |
| **Mock Detector** | 16kHz float32 audio | FFT high-frequency ratio heuristic simulation | Fast, zero-dependency deterministic simulation for CI pipelines and automated testing. | **REAL TEST FIXTURE** (active when `TRUEVOICE_ML_MODE=mock`). |

---

## 11. SPEAKER BIOMETRICS — ECAPA-TDNN

### Speaker Verification vs. Speaker Identification
- **Speaker Identification (1:N):** "Who is speaking out of $N$ enrolled users in the database?"
- **Speaker Verification (1:1):** "Does this incoming voice belong to the specific user whose account is being accessed?" TrueVoice strictly performs 1:1 verification against the session's claimed speaker.

### ECAPA-TDNN Architecture (SpeechBrain)
- **Architecture:** *Emphasized Channel Attention, Propagation, and Aggregation Time Delay Neural Network* (Desplanques et al., Interspeech 2020).
- **Key Enhancements over x-vectors:**
  1. 1D Dilated Convolutions (TDNN) capturing wide temporal receptive fields.
  2. Squeeze-and-Excitation (SE) channel attention blocks recalibrating filter responses.
  3. Multi-layer feature aggregation concatenating intermediate layer representations.
- **Embedding Dimension:** `192-dimensional` unit-normalized vector ($\|v\|_2 = 1.0$).
- **Multi-Sample Enrollment Centroid:**
  $$\mathbf{c} = \frac{1}{M} \sum_{i=1}^M \mathbf{e}_i, \quad \mathbf{e}_{\text{enrolled}} = \frac{\mathbf{c}}{\|\mathbf{c}\|_2 + 10^{-9}}$$
- **Geometric Similarity Metric:** Cosine similarity mapped linearly from $[-1.0, 1.0]$ to $[0.0, 1.0]$:
  $$\text{Cosine Sim} = \mathbf{e}_{\text{live}} \cdot \mathbf{e}_{\text{enrolled}}$$
  $$\text{Similarity} = \frac{\text{Cosine Sim} + 1.0}{2.0}$$
  $$\text{Distance} = 1.0 - \text{Similarity}$$
- **Operational Threshold:** Configurable operating point defaulting to `0.75` (`TRUEVOICE_SPEAKER_THRESHOLD`).
- **CRITICAL VIVA NOTE ON CALIBRATION:**  
  *The threshold of 0.75 is an operational configuration threshold on geometric similarity, NOT an empirically validated universal Equal Error Rate (EER) constant. In production, this threshold must be calibrated against the target telephony channel environment.*

---

## 12. DSP / ACOUSTIC FORENSICS AUDIT

TrueVoice computes **12 physical signal measurements** deterministically without neural network dependencies in [`backend/app/forensics/analyzer.py`](file:///c:/Projects/SIH/backend/app/forensics/analyzer.py):

| Metric | Mathematical Formula | Acoustic Meaning | TrueVoice Usage / Threshold |
| :--- | :--- | :--- | :--- |
| **RMS Energy** | $\text{RMS} = \sqrt{\frac{1}{N}\sum x[i]^2}$ | Overall signal power and loudness level | Energy stability; silence detection |
| **Zero Crossing Rate (ZCR)** | $\text{ZCR} = \frac{1}{2N}\sum \| \text{sgn}(x[i]) - \text{sgn}(x[i-1]) \|$ | Rate of sign changes in time domain | Distinguishes voiced vowel sounds from unvoiced/fricative noise |
| **Mean Pitch ($F_0$)** | Normalized Autocorrelation Peak + Parabolic Interpolation | Fundamental vocal cord vibration frequency | Tracks human vocal range ($50\text{--}500\text{ Hz}$) |
| **Max Pitch Jump** | $\max \|F_0[t] - F_0[t-1]\|$ between adjacent frames | Pitch trajectory discontinuity | Detects unnatural pitch steps ($>50\text{ Hz}$) common in concatenated speech |
| **Local Jitter** | $\text{Jitter} = \frac{\frac{1}{K-1}\sum \|T_i - T_{i+1}\|}{\frac{1}{K}\sum T_i}$ | Micro-fluctuations in pitch period length | Natural human speech exhibits micro-tremors ($0.2\%\text{--}1.0\%$). Synthesizers are often unnaturally periodic ($<0.002$). |
| **Local Shimmer** | $\text{Shimmer} = \frac{\frac{1}{K-1}\sum \|A_i - A_{i+1}\|}{\frac{1}{K}\sum A_i}$ | Cycle-to-cycle peak amplitude variations | Natural speech exhibits amplitude variability ($>1.5\%$). Overly smooth speech suggests vocoder generation. |
| **Harmonics-to-Noise Ratio (HNR)** | $\text{HNR} = 10 \log_{10}\left(\frac{r_{\max}}{1.0 - r_{\max}}\right)$ | Ratio of periodic vocal energy to turbulent noise | Distinguishes voiced phonation from synthetic hiss or whispering ($<15\text{ dB}$). |
| **Spectral Centroid** | $\text{Centroid} = \frac{\sum f \cdot \|X(f)\|}{\sum \|X(f)\|}$ | Center of mass of the frequency spectrum | Measures perceived audio "brightness"; telephony companding alters this. |
| **Spectral Rolloff** | Frequency $f_c$ such that $\sum_{0}^{f_c} \|X(f)\| = 0.85 \sum \|X(f)\|$ | Skewness of spectral energy distribution | Detects abnormal high-frequency cutoff artifacts. |
| **Spectral Flatness** | $\text{Flatness} = \frac{\exp\left(\frac{1}{M}\sum \ln \|X(f)\|^2\right)}{\frac{1}{M}\sum \|X(f)\|^2}$ | Ratio of geometric mean to arithmetic mean of power | Measures noise-likeness (1.0 = white noise, 0.0 = pure tone). |
| **Spectral Flux** | $\text{Flux} = \sum (\|X_t(f)\| - \|X_{t-1}(f)\|)^2$ | Rate of spectral frame changes over time | Detects synthetic robotic static timbre vs dynamic human speech. |
| **Energy Distribution** | Band ratios: Low ($0\text{--}1\text{kHz}$), Mid ($1\text{--}3\text{kHz}$), High ($>3\text{kHz}$) | Energy concentration across acoustic bands | Checks vocal tract formants vs telephony bandpass degradation. |

### Critical Viva Distinction: DSP Anomaly $\neq$ Proof of Deepfake
*Physical acoustic measurements indicate acoustic abnormalities (such as poor microphone quality, clipping, telephony bandpass filtering, background noise, or vocoder smoothing). They are combined into a physical anomaly score ($S_{\text{forensic}}$), but they NEVER constitute standalone proof of synthetic voice.*

---

## 13. ASR — FASTER-WHISPER INTEGRATION

- **Engine:** `faster-whisper` wrapping CTranslate2 in [`backend/app/asr/whisper.py`](file:///c:/Projects/SIH/backend/app/asr/whisper.py).
- **Architecture:** Transformer Encoder-Decoder processing 80-channel log-mel filterbanks.
- **Quantization:** Defaults to `int8` on CPU, `float16` on CUDA for real-time factor $< 0.15\times$.
- **Multilingual Support:** Dynamic language detection or forced via `TRUEVOICE_ASR_LANGUAGE`. Supports English, Hindi, Punjabi, and code-switched Hinglish.
- **Privacy Guarantee:** Transcripts in database records are truncated/redacted; raw audio waveforms are NEVER stored in database tables or server logs.

---

## 14. CONVERSATIONAL INTELLIGENCE (INTENT ANALYZER)

Implemented in [`backend/app/intelligence/intent.py`](file:///c:/Projects/SIH/backend/app/intelligence/intent.py). Scans ASR transcripts across **9 structured threat categories**:

1. `AUTHORITY_IMPERSONATION` (Weight: 0.25): Claims of executive (CEO, CFO), IT support, or law enforcement authority.
2. `FINANCIAL_URGENCY` (Weight: 0.30): Immediate wire transfers, RTGS/NEFT deadlines, threats of deal collapse.
3. `CREDENTIAL_SOLICITATION` (Weight: 0.35): Demands for corporate login credentials, admin passwords, security PINs.
4. `MFA_OTP_SOLICITATION` (Weight: 0.40): Requests to read out 6-digit one-time passcodes or approve push notifications.
5. `SECURITY_BYPASS` (Weight: 0.30): Explicit requests to waive dual control, override protocols, or skip approvals.
6. `SECRECY_REQUEST` (Weight: 0.25): Demands to keep communication confidential or concealed from internal management.
7. `CALLBACK_SUPPRESSION` (Weight: 0.30): Instructions discouraging out-of-band verification ("do not call back", "stay on this line").
8. `COERCION_PRESSURE` (Weight: 0.30): Threats of account suspension, arrest warrants, disciplinary termination.
9. `UNUSUAL_PAYMENT_INSTRUCTION` (Weight: 0.35): Demands for settlement via cryptocurrency, gift cards, or temporary offshore accounts.

### Defensive Speech Suppression & Anti-False-Positive Logic
- **Single Keywords Do Not Trigger Fraud:** The system uses contextual regular expressions requiring verb-noun couplings (e.g. `read out` + `OTP`, rather than the isolated word `code`).
- **Defensive Suppression:** Scans for standard institutional security disclaimers:
  ```regex
  \b(bank will never ask|we will never ask for your (otp|password|pin)|beware of fraud)\b
  ```
  If a defensive phrase is detected in the transcript, conversational threat scoring is suppressed to prevent alerting on legitimate support agents educating callers.

---

## 15. CONTEXT ENGINE & OPERATIONAL SIGNALS

Implemented in [`backend/app/intelligence/context.py`](file:///c:/Projects/SIH/backend/app/intelligence/context.py). Evaluates **8 operational context signals**:

1. **Transaction Amount:** Penalizes high-value operations ($\ge ₹10\text{ Lakh}$, penalty $+0.35$) and elevated operations ($\ge ₹2.5\text{ Lakh}$, penalty $+0.15$).
2. **New Beneficiary:** Unfamiliar or newly added transfer destination ($+0.30$).
3. **Unusual Channel:** Call arriving from non-standard SIP trunk or unrecognized gateway ($+0.20$).
4. **Off-Hours Operation:** Interaction initiated outside tenant operational business hours ($+0.15$).
5. **Caller Directory Mismatch:** Gateway Automatic Number Identification (ANI) diverges from registered profile ($+0.20$).
6. **Privileged User:** Account holds administrative or executive privileges ($+0.25$).
7. **Sensitive Operation:** Password reset, limit increase, device pairing, or MFA override ($+0.30$).
8. **Unusual Transaction Velocity:** Out-of-band transaction frequency ($+0.20$).

*All thresholds and penalties are configurable per tenant organization via the `tenant_policy` dictionary.*

---

## 16. MATHEMATICAL RISK FUSION (VIVA CORE)

Implemented in [`backend/app/risk/fusion.py:MultiSignalRiskFusion`](file:///c:/Projects/SIH/backend/app/risk/fusion.py).

### Baseline Weights (Sum = 1.0)
From [`backend/app/config.py`](file:///c:/Projects/SIH/backend/app/config.py):
* $w_{\text{deepfake}} = 0.35$
* $w_{\text{speaker}} = 0.25$
* $w_{\text{context}} = 0.15$
* $w_{\text{conv}} = 0.15$
* $w_{\text{forensic}} = 0.10$

### 1. Dynamic Weight Renormalization
If a signal is unavailable (e.g. no speaker enrolled, or silence prevents ASR), TrueVoice **never assumes missing evidence is safe ($0.0$) or malicious ($1.0$)**. Instead, base weights are dynamically renormalized across only the active signals $\mathcal{A}$:

$$\hat{w}_i = \frac{w_i}{\sum_{j \in \mathcal{A}} w_j}$$

$$\sum_{i \in \mathcal{A}} \hat{w}_i = 1.0$$

### 2. Linear Combination
Each available signal is normalized into $[0.0, 1.0]$:
* $s_{\text{df}} \in [0.0, 1.0]$ (from $0\text{--}100$)
* $s_{\text{speaker}} = 1.0 - \text{Similarity} \in [0.0, 1.0]$
* $s_{\text{conv}} \in [0.0, 1.0]$
* $s_{\text{context}} \in [0.0, 1.0]$
* $s_{\text{forensic}} \in [0.0, 1.0]$ (from $0\text{--}100$)

$$R_{\text{linear}} = 100.0 \times \sum_{i \in \mathcal{A}} \hat{w}_i \cdot s_i$$

### 3. Non-Linear Compounding Multiplier ($\Gamma = 1.35$)
When a critical deepfake artifact is corroborated by biometric mismatch or conversational threat, the risk compounds non-linearly:
$$\text{If } S_{\text{df}} \ge 70.0 \text{ AND } (S_{\text{speaker}} \le 0.50 \text{ OR } S_{\text{conv}} \ge 0.70 \text{ OR } S_{\text{context}} \ge 0.70):$$
$$R_{\text{raw}} = \min(100.0, R_{\text{linear}} \times 1.35)$$

---

## 17. RISK SCORE MEANING & TIERS

### What the Score Is and Is Not
* **WHAT IT IS:** A normalized operational security risk metric in $[0.0, 100.0]$ representing the exposure of the voice interaction.
* **WHAT IT IS NOT:** It is **NOT** a mathematical probability of fraud ($P(\text{Fraud})$), not an empirical frequency certainty, and not standalone legal proof of criminal intent.

### Operational Risk Tiers
* **$0.0 \text{ -- } 29.9$ : LOW:** Normal baseline interaction. Standard operational monitoring.
* **$30.0 \text{ -- } 59.9$ : MODERATE:** Heightened scrutiny. Visual caution banner displayed to operator.
* **$60.0 \text{ -- } 79.9$ : HIGH:** Step-up secondary verification required (out-of-band push challenge).
* **$80.0 \text{ -- } 100.0$ : CRITICAL:** Immediate defensive action. Session blocking and transaction hold.

---

## 18. TEMPORAL SMOOTHING (ASYMMETRIC EMA)

Implemented in [`backend/app/risk/engine.py:SessionRiskEngine`](file:///c:/Projects/SIH/backend/app/risk/engine.py).

### Why Temporal Smoothing is Essential
Audio streaming produces windowed inferences every 500ms. Transient background noise, coughing, or temporary network jitter could cause a single frame to spike the deepfake score. Without smoothing, the UI would flicker and trigger false-alarm disconnects.

### Mathematical Formula: Asymmetric Exponential Moving Average
Let $R_t$ be the raw fused score at time $t$, and $S_t$ be the smoothed risk score:

$$S_t = \alpha \cdot R_t + (1 - \alpha) \cdot S_{t-1}$$

Where the smoothing factor $\alpha$ is asymmetric:
$$\alpha = \begin{cases} \alpha_{\text{attack}} = 0.60, & \text{if } R_t > S_{t-1} \quad (\text{Threat Escalation}) \\ \alpha_{\text{decay}} = 0.20, & \text{if } R_t \le S_{t-1} \quad (\text{Threat De-escalation}) \end{cases}$$

### Numeric Viva Example
1. **Attack Escalation:**
   - Previous smoothed score $S_{t-1} = 20.0$.
   - Sudden synthetic audio burst yields raw score $R_t = 80.0$.
   - Since $R_t > S_{t-1}$, $\alpha = 0.60$:
     $$S_t = 0.60 \times 80.0 + 0.40 \times 20.0 = 48.0 + 8.0 = 56.0$$
   - The risk jumps immediately into the `MODERATE` tier in a single 0.5s hop.
2. **Cautious Decay:**
   - Next frame returns to normal background audio $R_{t+1} = 20.0$.
   - Since $R_{t+1} < S_t$, $\alpha = 0.20$:
     $$S_{t+1} = 0.20 \times 20.0 + 0.80 \times 56.0 = 4.0 + 44.8 = 48.8$$
   - The risk drops slowly over multiple hops, preventing attackers from evading detection by inserting silent pauses between deepfake utterances.

---

## 19. SIGNAL AVAILABILITY MATRIX

How TrueVoice handles missing components:

| Scenario | Handled By | Action Taken | Security Principle |
| :--- | :--- | :--- | :--- |
| **No Speaker Enrolled** | `app.services.audio_service.py:133` | Emits `VerificationResult(signal_availability=UNAVAILABLE, similarity=None)` | Missing biometric profile does NOT penalize caller as an imposter, but does NOT verify them. |
| **Caller is Silent** | `app.audio.vad.py` | VAD returns `False`. ASR emits empty transcript. | Prevents ambient background noise from generating hallucinated ASR threat flags. |
| **GPU / ML Model Failure** | `app.detectors.wav2vec2.detector.py` | Catches exception, emits `DeepfakeResult(signal_availability=UNAVAILABLE)` | System degrades gracefully; fails to dynamic weight renormalization without crashing the call. |
| **Missing Request Metadata** | `app.intelligence.context.py` | Falls back to defaults (`amount=0.0`, standard channel) | Operates on baseline context without false escalations. |

---

## 20. DECLARATIVE POLICY ENGINE

Implemented in [`backend/app/policy/engine.py:DeclarativePolicyEngine`](file:///c:/Projects/SIH/backend/app/policy/engine.py).

### Decoupling Risk from Policy
* **Risk Engine:** Computes *what is happening* (mathematical exposure score).
* **Policy Engine:** Decides *what to do about it* (operational security action and state transition).

### CRITICAL SECURITY INVARIANT
> **A high deepfake score ALONE does NOT automatically trigger BLOCK.**

If a caller's deepfake score reaches 85%, but their biometric voiceprint is verified ($s_{\text{speaker}} > 0.75$) and there is no financial urgency or intent flag, the system issues `REQUEST_VERIFICATION` or `WARN`, but does **NOT** instantly drop the call. Why? An acoustic artifact may stem from a poor cellular connection, microphone clipping, or Bluetooth compression. TrueVoice requires **corroborating evidence** (biometric mismatch OR threat phrases OR high-value transaction) before executing an irreversible `BLOCK`.

### Evaluated Rules (in Priority Order)
1. `RULE_CRITICAL_RISK_BLOCK`: Composite risk $\ge 80.0$ OR dual anomaly confirmed (synthetic $\ge 0.75$ AND mismatch/threat) $\rightarrow$ `BLOCK` (`BLOCKED`).
2. `RULE_EXECUTIVE_IMPERSONATION_ESCALATE`: Claim of executive/privileged authority with elevated risk $\rightarrow$ `HUMAN_REVIEW` (`HUMAN_REVIEW`).
3. `RULE_HIGH_VALUE_TRANSACTION_HOLD`: Transaction $\ge ₹2.5\text{ Lakh}$ with elevated risk $\rightarrow$ `RESTRICT` (`RESTRICTED`).
4. `RULE_HIGH_RISK_STEP_UP_VERIFY`: Composite risk $\ge 60.0 \rightarrow$ `REQUEST_VERIFICATION` (`VERIFYING`).
5. `RULE_MODERATE_RISK_WARN`: Composite risk $\ge 30.0 \rightarrow$ `WARN` (`CAUTION`).
6. `RULE_LOW_RISK_ALLOW`: Baseline risk $< 30.0 \rightarrow$ `ALLOW` (`TRUSTED`).

---

## 21. ZERO-TRUST STATE MACHINE

Implemented in [`backend/app/policy/state_machine.py:ZeroTrustStateMachine`](file:///c:/Projects/SIH/backend/app/policy/state_machine.py).

### Permissible State Transitions Table

| Current State | Permissible Next States | Trigger Conditions |
| :--- | :--- | :--- |
| `OBSERVING` | `CAUTION`, `VERIFYING`, `TRUSTED`, `RESTRICTED`, `BLOCKED`, `HUMAN_REVIEW`, `TERMINATED` | Initial state upon session creation. Transitions as first audio frames evaluate. |
| `CAUTION` | `OBSERVING`, `VERIFYING`, `TRUSTED`, `RESTRICTED`, `BLOCKED`, `HUMAN_REVIEW`, `TERMINATED` | Moderate risk detected. Can de-escalate to `TRUSTED` if clear speech confirms authenticity. |
| `VERIFYING` | `TRUSTED`, `CAUTION`, `RESTRICTED`, `BLOCKED`, `HUMAN_REVIEW`, `TERMINATED` | Secondary OOB challenge dispatched. Succeeded $\rightarrow$ `TRUSTED`; Failed $\rightarrow$ `RESTRICTED`. |
| `TRUSTED` | `CAUTION`, `VERIFYING`, `RESTRICTED`, `BLOCKED`, `HUMAN_REVIEW`, `TERMINATED` | Active trusted session. Can drop back to `VERIFYING` if caller initiates a high-value wire. |
| `RESTRICTED` | `VERIFYING`, `BLOCKED`, `HUMAN_REVIEW`, `TERMINATED` | High risk or failed verification. Sensitive operations blocked until cleared by step-up or analyst. |
| `BLOCKED` | `HUMAN_REVIEW`, `TERMINATED` | **Only a human security analyst** can inspect and override a blocked session. |
| `HUMAN_REVIEW` | `TRUSTED`, `RESTRICTED`, `BLOCKED`, `TERMINATED` | Analyst override exits: `ANALYST_APPROVE`, `ANALYST_RESTRICT`, `ANALYST_BLOCK`. |
| `TERMINATED` | *None* | Terminal state. Session concluded; no outbound transitions permitted. |

---

## 22. SECURITY ACTION DISPATCH

When the policy engine outputs `REQUEST_VERIFICATION`, the secondary verification service ([`backend/app/services/verification_service.py`](file:///c:/Projects/SIH/backend/app/services/verification_service.py)) is invoked:
1. Generates a cryptographically random 6-digit numeric OTP challenge using `secrets.randbelow(900000) + 100000`.
2. Stores hashed challenge with a strict **30-second TTL** (`OOB_CHALLENGE_TTL_SECONDS`).
3. Dispatches Out-of-Band (OOB) push notification to the customer's registered mobile device.
4. If verified, transitions state to `TRUSTED`. If expired or replayed, marks challenge `TIMEOUT`/`REJECTED`.

---

## 23. CRYPTOGRAPHIC AUDIT SYSTEM

Implemented in [`backend/app/audit/chain.py:AuditLedgerChainer`](file:///c:/Projects/SIH/backend/app/audit/chain.py).

### Hash-Chaining Formula
For event sequence $n$:
$$H_0 = \text{"0000000000000000000000000000000000000000000000000000000000000000"}\quad (64\text{ zeros})$$
$$H_n = \text{SHA-256}\left(H_{n-1} \;\|\; \text{CanonicalJSON}(\text{Event}_n)\right)$$

Where `CanonicalJSON` is strictly serialized:
- Keys sorted alphabetically (`sort_keys=True`).
- Whitespace stripped (`separators=(',', ':')`).
- UTF-8 safe encoding.

### Tamper-Evident vs. Immutable
* **Honest Viva Distinction:** TrueVoice provides a **tamper-evident** audit ledger, NOT an immutable blockchain. If an adversary with database access modifies or deletes an audit row, the cryptographic hash link $H_n \ne \text{SHA256}(H_{n-1} \| \dots)$ breaks immediately. The `AuditLedgerChainer.verify_chain()` method detects the exact sequence ID where tampering occurred.

---

## 24. AUTHENTICATION & DEFENSIVE CONTROLS

1. **Multi-Tenant JWT Authentication:** Bearer tokens with tenant boundary `org_id` embedded in claims. Validated by `enforce_tenant_isolation()` on every database query.
2. **WebSocket Single-Use Tickets:** URLs cannot contain long-lived bearer tokens (to prevent shoulder-surfing and log leakage). Clients call `POST /v1/auth/session-token` to obtain a 5-minute single-use ticket token scoped strictly to that `session_id`.
3. **Oversized Audio Frame Rejection:** Enforces 64 KB maximum message size on WebSocket; closes connection with code 1009 if violated.
4. **Zero Raw Audio Storage:** Raw audio chunks are processed in circular RAM buffers and overwritten. Neither PostgreSQL nor application logs store uncompressed audio recordings, ensuring strict GDPR/privacy compliance.

---

## 25. DATABASE LAYER & RELATIONSHIPS

* **PostgreSQL Schema (via SQLAlchemy Models):**
  - `organizations`: Multi-tenant boundary root entity.
  - `users`: Operators, security analysts, and administrators.
  - `call_sessions`: Active and historical voice sessions with trust state and peak risk.
  - `speaker_profiles`: Enrolled identity metadata (user name, registration date).
  - `voiceprint_embeddings`: 192-dimensional floating-point vectors (`Vector(192)` or serialized array).
  - `risk_assessments`: Windowed risk evaluations (synthetic probability, similarity, composite risk).
  - `conversation_analyses`: Transcripts, threat categories, and detected intent flags.
  - `verification_events`: Out-of-band challenge lifecycle tracking.
  - `security_actions`: Policy enforcement records.
  - `audit_logs`: SHA-256 hash-chained immutable audit records.

---

## 26. API & WEBSOCKET ENDPOINTS

| Method | Endpoint | Authentication | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/auth/login` | None | Authenticates email/password, returns JWT. |
| `POST` | `/v1/auth/session-token` | Bearer JWT | Generates short-lived (5 min) WebSocket session ticket. |
| `POST` | `/v1/sessions` | Bearer JWT | Initializes a new call session under tenant boundary. |
| `GET` | `/v1/sessions/{session_id}` | Bearer JWT | Retrieves detailed session metadata and status. |
| `POST` | `/v1/sessions/{session_id}/override`| Analyst JWT | Enforces human reviewer decision (`APPROVE`, `RESTRICT`, `BLOCK`). |
| `WS` | `/v1/stream/{session_id}` | Ticket Token | Real-time audio chunk ingestion and telemetry broadcast. |
| `GET` | `/v1/risk/{session_id}/timeline` | Bearer JWT | Retrieves chronological risk score history. |
| `GET` | `/v1/audit/{session_id}/logs` | Auditor JWT | Retrieves audit records with hash verification status. |
| `GET` | `/v1/health` | None | System diagnostics, resident detector status, DB connectivity. |

---

## 27. WHAT IS REAL vs. MOCKED vs. FALLBACK

| Component | REAL Implementation | MOCKED / SIMULATED | FALLBACK Behavior | Viva Status |
| :--- | :---: | :---: | :---: | :--- |
| **Wav2Vec 2.0** | ✅ (Full PyTorch adapter) | ❌ | Returns `UNAVAILABLE` if no checkpoint | **REAL CODE** (requires fine-tuned weights) |
| **RawNet2** | ✅ (Pure PyTorch SincNet) | ❌ | Returns `UNAVAILABLE` if no checkpoint | **REAL CODE** (requires checkpoint weights) |
| **AASIST** | ✅ (Pure PyTorch GAT) | ❌ | Returns `UNAVAILABLE` if no checkpoint | **REAL CODE** (requires checkpoint weights) |
| **ECAPA-TDNN** | ✅ (SpeechBrain adapter) | ❌ | Returns `UNAVAILABLE` if no SpeechBrain | **REAL CODE** (active in live ML mode) |
| **Faster-Whisper**| ✅ (CTranslate2 INT8) | ❌ | Returns `UNAVAILABLE` if no model | **REAL CODE** (active in live ML mode) |
| **DSP Forensics** | ✅ (12 physical metrics) | ❌ | Zero values if buffer $< 800$ samples | **100% REAL & ACTIVE IN ALL MODES** |
| **Intent Analyzer**| ✅ (9 threat categories) | ❌ | Zero score if transcript empty | **100% REAL & ACTIVE IN ALL MODES** |
| **Context Engine** | ✅ (8 operational signals)| ❌ | Zero score if metadata absent | **100% REAL & ACTIVE IN ALL MODES** |
| **Risk Fusion** | ✅ (Dynamic re-weighting)| ❌ | Baseline 0.0 if all signals missing | **100% REAL & ACTIVE IN ALL MODES** |
| **Policy Engine** | ✅ (Declarative rules) | ❌ | Baseline `ALLOW` if risk is low | **100% REAL & ACTIVE IN ALL MODES** |
| **Audit Ledger** | ✅ (SHA-256 hash chain) | ❌ | Chain validation reports broken link | **100% REAL & ACTIVE IN ALL MODES** |
| **Mock ML Fixtures**| ❌ | ✅ (`MockDeepfake`, etc.)| Only active if `TRUEVOICE_ML_MODE=mock`| **TEST FIXTURES ONLY** |

---

## 28. ONE COMPLETE VIVA END-TO-END DEFENSE SCENARIO

### Illustrative Attack Scenario Walkthrough
```text
Context: A corporate finance officer receives a call claiming to be the Chief Executive Officer (CEO).
Metadata: Transaction Amount = ₹15,00,000 (High-Value), Channel = WEBSOCKET_GATEWAY.

1. Caller speaks: "This is the CEO. We have an emergency acquisition. Wire 15 lakhs immediately and do not call me back."
2. Audio arrives over WebSocket in PCM16 LE chunks.
3. Preprocessing resamples to 16kHz, VAD confirms active speech (-22 dBFS).
4. Circular buffer accumulates 2.0s window; hop triggers evaluation.
5. Inferences execute concurrently:
   - Wav2Vec2 detects vocoder phase artifacts: score = 84.0 / 100.0 (SYNTHETIC).
   - ECAPA-TDNN compares against enrolled CEO voiceprint: similarity = 0.38 (MISMATCH).
   - DSP Forensics detects unnatural pitch stability: max pitch jump = 12 Hz, local jitter = 0.001 (anomaly = 68.0).
   - Faster-Whisper transcribes: "This is the CEO... Wire 15 lakhs immediately..."
6. Intent Analyzer matches:
   - AUTHORITY_IMPERSONATION ("this is the ceo")
   - FINANCIAL_URGENCY ("wire 15 lakhs immediately")
   - CALLBACK_SUPPRESSION ("do not call me back")
   -> Conversational Threat Score = 0.85.
7. Context Engine flags amount >= ₹10 Lakh -> Context Score = 0.70.
8. Risk Fusion calculates:
   - Deepfake (0.84), Speaker Mismatch (0.62), Intent (0.85), Context (0.70), Forensics (0.68).
   - Compounding Multiplier triggers (Synthetic >= 70 AND corroborated mismatch/threat):
     R_linear = 75.2 -> Compounded R_raw = 75.2 * 1.35 = 100.0 (clamped).
9. Temporal Smoothing:
   - Previous smoothed risk = 25.0. Attack alpha = 0.60:
     R_smoothed = 0.60 * 100.0 + 0.40 * 25.0 = 70.0.
10. Policy Engine evaluates rules:
    - Deepfake score (0.84) >= 0.75 AND Speaker Mismatch (0.62) >= 0.50 -> Dual Anomaly Confirmed.
    - Matches RULE_DUAL_ANOMALY_CONFIRMED_BLOCK.
11. State Machine transitions: OBSERVING -> BLOCKED.
12. Security Action BLOCK dispatched: Session audio streaming terminated, transaction held.
13. Audit event logged with SHA-256 hash chaining.
14. Telemetry broadcast renders red CRITICAL alert on dashboard with full factor provenance.
```

---

## 29. 50+ TECHNICAL VIVA DEFENSE QUESTIONS & ANSWERS

### Basic / Fundamentals
1. **Q: What is FastAPI and why was it chosen over Flask or Django?**  
   *A:* FastAPI is an asynchronous ASGI web framework built on Starlette and Pydantic. It natively supports Python `async/await`, achieving high concurrent I/O throughput necessary for handling hundreds of simultaneous audio WebSocket connections with minimal event-loop blocking.
2. **Q: Why is WebSocket required instead of standard HTTP REST for audio?**  
   *A:* HTTP request/response overhead (headers, TCP handshake) introduces unacceptable latency for streaming audio. WebSocket establishes a persistent, full-duplex TCP connection, allowing continuous raw PCM chunk ingestion and sub-second telemetry broadcast over a single socket.
3. **Q: Why is audio standardized to 16,000 Hz (16 kHz)?**  
   *A:* 16 kHz is the native training standard for foundational speech models (Wav2Vec 2.0, Whisper, ECAPA-TDNN). It provides an 8 kHz Nyquist bandwidth, capturing human speech formants while reducing computational overhead compared to 44.1/48 kHz studio audio.
4. **Q: What does PCM16 LE mean?**  
   *A:* Pulse Code Modulation, 16-bit signed integer, Little-Endian byte order. Each sample is represented by 2 bytes with values from $-32,768$ to $+32,767$.
5. **Q: What is the difference between Speaker Identification and Speaker Verification?**  
   *A:* Identification is 1:N matching (finding who is speaking among many candidates). Verification is 1:1 matching (confirming if the current speaker matches the single claimed identity profile). TrueVoice does 1:1 verification.
6. **Q: What is Voice Activity Detection (VAD)?**  
   *A:* An algorithm that detects whether an audio frame contains active human speech or ambient silence/background noise.
7. **Q: What is an analysis window and what is a hop size?**  
   *A:* An analysis window (2.0s) is the duration of audio evaluated by the models. A hop size (0.5s) is the time step between successive evaluations, creating an overlapping sliding window.
8. **Q: What is an embedding vector?**  
   *A:* A dense numerical vector (e.g. 192 floats in ECAPA-TDNN) that represents the unique biometric acoustic characteristics of a speaker's vocal tract in geometric space.
9. **Q: What is cosine similarity?**  
   *A:* The dot product of two unit-normalized vectors, measuring the cosine of the angle between them: $\cos(\theta) = \frac{A \cdot B}{\|A\| \|B\|}$. $1.0$ indicates identical direction, $0.0$ orthogonal, $-1.0$ opposite.
10. **Q: What is ASR?**  
    *A:* Automatic Speech Recognition — translating acoustic speech waveforms into written text tokens.

### Intermediate / Model Architectures
11. **Q: Why does TrueVoice use Wav2Vec 2.0 for deepfake detection?**  
    *A:* Its multi-head self-attention transformer layers capture long-range temporal dependencies and subtle phoneme transition discontinuities introduced by neural vocoders that short-window CNNs overlook.
12. **Q: What problem does RawNet2 solve that spectrogram models cannot?**  
    *A:* STFT spectrograms discard phase information and force a fixed time-frequency resolution trade-off. RawNet2 operates directly on raw waveforms in the time domain, preserving subtle phase anomalies.
13. **Q: What are SincNet filters?**  
    *A:* Parametric convolutional filters where the kernel is defined as a sinc function bandpass filter. Only the low and high cutoff frequencies are learned via backpropagation, initialized on the mel scale.
14. **Q: How does AASIST differ from standard CNN/RNN architectures?**  
    *A:* AASIST models spectro-temporal interactions as a heterogeneous graph, using graph attention networks (GAT) to correlate spectral sub-band anomalies with disparate temporal time frames.
15. **Q: Why compute DSP forensics if deep learning models are already present?**  
    *A:* Deep learning models are black boxes that can be fooled by adversarial perturbations or out-of-distribution telephony codecs. DSP forensics computes deterministic, mathematically verifiable physical measurements (pitch jumps, jitter, shimmer, HNR) that provide human-interpretable evidence.
16. **Q: What is Jitter and Shimmer in speech forensics?**  
    *A:* Jitter measures cycle-to-cycle variations in fundamental frequency ($F_0$). Shimmer measures cycle-to-cycle variations in peak amplitude. Natural human vocal cords always exhibit micro-tremors; synthetic speech is often unnaturally perfect.
17. **Q: What is Harmonics-to-Noise Ratio (HNR)?**  
    *A:* The ratio of periodic vocal cord energy to turbulent airflow noise in decibels. Low HNR indicates whispering, hoarseness, or synthetic vocoder hiss.
18. **Q: Why does TrueVoice fuse multiple signals instead of relying on deepfake detection alone?**  
    *A:* Audio deepfake detectors have high false-positive rates on real-world cellular/PSTN networks. Fusing deepfake scores with speaker biometrics, conversational intent, operational context, and forensics prevents legitimate callers from being falsely blocked.
19. **Q: What is the role of Faster-Whisper in TrueVoice?**  
    *A:* It provides rapid, quantized INT8/FP16 streaming transcription to feed the Intent Analyzer for conversational threat detection.
20. **Q: How does the Intent Analyzer prevent false positives from support agents mentioning passwords?**  
    *A:* It applies defensive speech suppression regexes (e.g. "bank will never ask for your password") that negate threat scoring if institutional fraud warnings are detected in the transcript.

### Advanced Risk & Mathematical Fusion
21. **Q: Why is the risk score NOT a probability of fraud?**  
    *A:* A probability represents the likelihood of an outcome in a closed sample space. The TrueVoice risk score is a multi-criteria normalized security exposure metric in $[0.0, 100.0]$ combining acoustic artifacts, biometric distance, transaction exposure, and intent threats.
22. **Q: How does dynamic weight renormalization work?**  
    *A:* When a signal is unavailable, base weights of active signals are divided by the sum of active base weights ($\hat{w}_i = w_i / \sum_{\mathcal{A}} w$). The active weights always sum to $1.0$, preventing missing data from being treated as either safe or malicious.
23. **Q: What is the non-linear compounding multiplier ($\Gamma = 1.35$)?**  
    *A:* If a high deepfake score ($\ge 70$) is corroborated by biometric mismatch or active threat phrases, the linear risk score is multiplied by $1.35$ (clamped to $100$) to reflect exponential risk escalation when multiple distinct attack vectors coincide.
24. **Q: Why use asymmetric exponential moving average (EMA) smoothing?**  
    *A:* To achieve fast threat escalation ($\alpha_{\text{attack}} = 0.60$) when an attack begins, but cautious de-escalation ($\alpha_{\text{decay}} = 0.20$) when audio returns to silence, preventing attackers from evading detection via pauses.
25. **Q: What happens if an enrolled speaker's profile does not exist for a session?**  
    *A:* The speaker verification signal is marked `SignalAvailability.UNAVAILABLE`. The risk fusion engine renormalizes weights across the remaining 4 signals without penalizing the caller.
26. **Q: Why does TrueVoice require a dual anomaly confirmation gate before blocking?**  
    *A:* Cellular codecs, packet loss, or poor headsets can trigger false deepfake spikes. Requiring deepfake $\ge 0.75$ plus biometric mismatch or conversational threat prevents erroneous call termination for authenticated users.
27. **Q: How are out-of-band (OOB) challenges protected against replay attacks?**  
    *A:* Challenges have a strict 30-second TTL, are invalidated immediately upon first verification attempt, and are bound strictly to the `session_id`.
28. **Q: What is the purpose of the Zero-Trust State Machine?**  
    *A:* It strictly decouples raw continuous risk scores from discrete security authorization states (`OBSERVING`, `CAUTION`, `VERIFYING`, `TRUSTED`, `RESTRICTED`, `BLOCKED`, `HUMAN_REVIEW`, `TERMINATED`).
29. **Q: Can a session transition from `BLOCKED` directly to `TRUSTED`?**  
    *A:* No. The state machine enforces that a `BLOCKED` session can ONLY exit via `HUMAN_REVIEW`, requiring a human security analyst to review audit evidence and issue an override.
30. **Q: How does the system handle an oversized WebSocket audio frame?**  
    *A:* It rejects frames exceeding 65,536 bytes immediately and closes the WebSocket connection with status code `1009 (Message Too Big)`.

### Architecture & Scalability
31. **Q: Why is audio processing decoupled into two branches in the buffer?**  
    *A:* The ML branch receives normalized float32 audio suited for neural network feature extractors. The Forensic branch receives raw, un-normalized audio to preserve true physical amplitude, energy, and harmonic dynamics.
32. **Q: Why not process the entire audio recording at the end of the call?**  
    *A:* TrueVoice is a real-time voice security platform designed to stop active social engineering, fraud, and executive impersonation while the interaction is underway, before money is transferred.
33. **Q: How would TrueVoice scale to 10,000 concurrent streaming calls?**  
    *A:* By decoupling the WebSocket ingestion gateway from ML inference using a message bus (Redis Streams / Kafka). Lightweight gateways ingest audio and push chunks to GPU worker pools running Triton Inference Server, with session state cached in Redis.
34. **Q: Where would Redis fit in the current architecture?**  
    *A:* As a distributed pub/sub broker for WebSocket session tickets, cross-worker telemetry broadcasting, and caching session risk state across multi-pod Kubernetes clusters.
35. **Q: How are database transactions handled during streaming?**  
    *A:* In-memory processing and telemetry broadcast occur without blocking on database commits. Risk assessment rows and audit logs are flushed asynchronously via SQLAlchemy's async session.
36. **Q: Why is circular buffering used instead of appending to a dynamic list?**  
    *A:* Dynamic lists cause continuous memory allocations and garbage collection pauses. A fixed-size circular NumPy array pre-allocates memory for 10 seconds of audio and overwrites older samples with $O(1)$ complexity.
37. **Q: How does the system prevent thread starvation during heavy DSP calculations?**  
    *A:* CPU-bound DSP forensics and PyTorch synchronous inferences are offloaded from the main AsyncIO event loop into thread pools using `asyncio.to_thread`.
38. **Q: What is the purpose of the `DetectorRegistry`?**  
    *A:* It manages model lifecycles, keeping only the configured primary deepfake detector resident in memory to prevent GPU out-of-memory (OOM) crashes from loading multiple heavy models simultaneously.
39. **Q: How does the system handle multi-tenancy?**  
    *A:* All queries filter strictly by `org_id` extracted from validated JWT claims. Users from one organization cannot access sessions, speakers, or policies of another.
40. **Q: What is the difference between `TRUEVOICE_ML_MODE=mock` and `live`?**  
    *A:* `mock` runs deterministic FFT-based simulations without loading heavy neural checkpoints, allowing fast test execution and CI runs without GPU dependencies. `live` loads real PyTorch and SpeechBrain weights.

### Security & Cryptographic Auditing
41. **Q: How does the SHA-256 audit hash chain guarantee tamper evidence?**  
    *A:* Each record stores `event_hash = SHA256(prev_event_hash || CanonicalJSON(event))`. Modifying any past event alters its hash, which breaks the `prev_event_hash` link of all subsequent events, immediately exposing tampering.
42. **Q: What is `GENESIS_PREV_HASH`?**  
    *A:* A fixed 64-character string of zeros (`"0" * 64`) that serves as the root parent hash for the first event in every session's audit chain.
43. **Q: Why use session ticket tokens instead of passing the user's JWT in WebSocket URLs?**  
    *A:* Query parameters in URLs are logged by proxies, browser histories, and web server access logs. Using ultra-short-lived (5 min) single-use session tickets prevents bearer token theft.
44. **Q: What attack does single-use session ticket validation prevent?**  
    *A:* Replay attacks. An eavesdropper intercepting the ticket in transit cannot establish a second streaming session because the ticket is scoped to the specific session ID and expires rapidly.
45. **Q: Why does TrueVoice forbid storing raw audio recordings in database tables?**  
    *A:* Storing voice recordings creates massive liability under GDPR, CCPA, and DPDP laws, and provides attackers with a repository of biometric audio to clone. TrueVoice stores only mathematical embeddings and extracted features.
46. **Q: How are voiceprint templates protected?**  
    *A:* Voiceprints are stored as 192-dimensional numerical embeddings (`Vector192`), decoupled from customer demographic identities, and isolated under tenant boundaries.
47. **Q: What is an Analyst Override and why is it audited?**  
    *A:* When a human analyst manually approves or blocks a session via `POST /v1/sessions/{id}/override`, the action, reason, and analyst user ID are appended to the immutable audit ledger to prevent insider collusion.
48. **Q: What is defensive speech suppression?**  
    *A:* Suppressing fraud alert flags when the spoken text contains security education phrases (e.g. "do not share your OTP"), preventing false alarms during genuine customer support dialogues.
49. **Q: What prevents SQL injection in the TrueVoice backend?**  
    *A:* SQLAlchemy 2.0 uses parameterized prepared statements across all queries, preventing input strings from being executed as SQL syntax.
50. **Q: How does the backend prevent cross-tenant speaker profile enrollment?**  
    *A:* During session creation, `SessionService` queries the speaker profile with an explicit check `speaker.org_id != org_id`, raising a `TenantAccessViolation` if an operator attempts to bind a speaker from another tenant.

---

## 30. "EXPLAIN LIKE I'M IN VIVA" — COMPONENT CHEAT SHEET

### 1. Wav2Vec 2.0
* **WHAT:** Deep learning speech representation model fine-tuned for deepfake artifact classification.
* **WHY:** To catch subtle temporal, acoustic, and phase discontinuities created by neural vocoders.
* **HOW:** 16kHz audio $\rightarrow$ 7-layer CNN encoder $\rightarrow$ 12-layer Transformer self-attention $\rightarrow$ classification head.
* **INPUT:** 16 kHz mono float32 audio chunk (RMS normalized to -24 dBFS).
* **OUTPUT:** Synthetic voice probability score ($0.0 \text{--} 100.0$) and classification label.
* **LIMITATION:** Requires fine-tuned deepfake classification checkpoints; generic base checkpoints do not detect spoofs.

### 2. RawNet2
* **WHAT:** End-to-end raw waveform deepfake detector.
* **WHY:** Operates directly on raw audio in the time domain, avoiding STFT information loss.
* **HOW:** Audio $\rightarrow$ SincNet bandpass filterbank $\rightarrow$ F-SE residual blocks $\rightarrow$ Bi-GRU temporal pooling $\rightarrow$ Linear head.
* **INPUT:** Raw 16kHz audio waveform (pre-emphasis $\alpha=0.97$, zero-mean unit-variance).
* **OUTPUT:** Synthetic voice probability score ($0.0 \text{--} 100.0$).
* **LIMITATION:** Requires heavy GPU computation; sensitive to non-speech silence.

### 3. AASIST
* **WHAT:** Integrated Spectro-Temporal Graph Attention Network for audio anti-spoofing.
* **WHY:** Correlates spectral sub-band artifacts across disparate time frames using graph attention.
* **HOW:** Audio $\rightarrow$ SincNet $\rightarrow$ Spectro-temporal ResBlocks $\rightarrow$ Heterogeneous GAT $\rightarrow$ Readout.
* **INPUT:** Raw 16kHz audio waveform (peak-normalized).
* **OUTPUT:** Spoof class posterior probability ($0.0 \text{--} 100.0$).
* **LIMITATION:** High memory footprint during graph message passing.

### 4. ECAPA-TDNN
* **WHAT:** 192-dimensional biometric speaker verification model.
* **WHY:** Confirms whether the current speaker matches an enrolled authorized voiceprint.
* **HOW:** Audio $\rightarrow$ TDNN convolutions $\rightarrow$ Squeeze-and-Excitation channel attention $\rightarrow$ 192-d embedding $\rightarrow$ Cosine similarity.
* **INPUT:** 16 kHz mono speech audio + enrolled speaker centroid vector.
* **OUTPUT:** Geometric similarity score ($0.0 \text{--} 1.0$) and boolean verification match.
* **LIMITATION:** Threshold (0.75) is an operational threshold that must be tuned for target telephony channels.

### 5. Faster-Whisper
* **WHAT:** Quantized, low-latency automatic speech recognition engine.
* **WHY:** Transcribes live speech into text to detect social engineering and coercive threats.
* **HOW:** Audio $\rightarrow$ 80-channel log-mel spectrogram $\rightarrow$ Transformer Encoder-Decoder $\rightarrow$ Text tokens.
* **INPUT:** 16 kHz mono audio chunk.
* **OUTPUT:** Transcribed text string and language identification.
* **LIMITATION:** Transcriptions can degrade in heavy background noise or with strong regional accents.

### 6. DSP Forensics
* **WHAT:** Deterministic physical acoustic signal measurement suite.
* **WHY:** Provides mathematical, human-explainable physical evidence independent of black-box neural networks.
* **HOW:** Computes 12 metrics: Autocorrelation $F_0$, Local Jitter, Shimmer, HNR, Spectral Centroid, Rolloff, Flux, ZCR.
* **INPUT:** Raw, un-normalized 16kHz audio chunk.
* **OUTPUT:** Forensic anomaly score ($0.0 \text{--} 100.0$) and structured feature measurements dictionary.
* **LIMITATION:** Acoustic anomaly indicates degraded or altered audio, NOT standalone proof of a deepfake.

### 7. Intent Analyzer
* **WHAT:** Rule-based conversational threat intelligence scanner.
* **WHY:** Detects social engineering patterns (authority claims, urgency, OTP solicitation, wire requests).
* **HOW:** Regex scanning across 9 threat categories with defensive speech suppression.
* **INPUT:** ASR transcript text.
* **OUTPUT:** Threat score ($0.0 \text{--} 1.0$) and list of detected threat category flags.
* **LIMITATION:** Relies on transcript accuracy; cannot detect threats if words are spoken in an unsupported language.

### 8. Context Engine
* **WHAT:** Operational and transactional metadata evaluator.
* **WHY:** Weighs transaction exposure (amount, new beneficiary, channel, off-hours) against voice authenticity.
* **HOW:** Evaluates 8 context features against configurable tenant threshold policies.
* **INPUT:** Request context (transaction amount, operation type) and session context (channel, ANI).
* **OUTPUT:** Context sensitivity score ($0.0 \text{--} 1.0$) and risk factor descriptions.
* **LIMITATION:** Context reflects operational exposure, not voice authenticity.

### 9. Risk Fusion Engine
* **WHAT:** Mathematical multi-signal aggregator with dynamic weight renormalization.
* **WHY:** Combines 5 independent signals into a single normalized security exposure score.
* **HOW:** $\hat{w}_i = w_i / \sum w$; $R = \sum \hat{w}_i s_i$; applies $\Gamma=1.35$ compounding multiplier for dual anomalies.
* **INPUT:** Scores and availability statuses for Deepfake, Speaker, Forensics, Intent, Context.
* **OUTPUT:** Composite risk score in $[0.0, 100.0]$ and RiskTier (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`).
* **LIMITATION:** Output is an operational risk score, NOT a mathematical probability of fraud.

### 10. Temporal Smoothing
* **WHAT:** Asymmetric Exponential Moving Average (EMA) rolling filter.
* **WHY:** Prevents UI risk score jitter and false alarms from transient single-frame spikes.
* **HOW:** $S_t = \alpha R_t + (1 - \alpha) S_{t-1}$, with $\alpha_{\text{attack}} = 0.60$ and $\alpha_{\text{decay}} = 0.20$.
* **INPUT:** Raw fused score $R_t$ and previous smoothed score $S_{t-1}$.
* **OUTPUT:** Smoothed continuous risk score in $[0.0, 100.0]$.
* **LIMITATION:** Introduces a slight lag (1--2 hops / 0.5--1.0s) during sudden threat changes.

### 11. Declarative Policy Engine
* **WHAT:** Zero-Trust Policy Decision Point (PDP).
* **WHY:** Translates risk scores and context into actionable security controls.
* **HOW:** Evaluates deterministic business rules (mitigation invariant, high-value hold, step-up MFA).
* **INPUT:** Composite risk, trust state, signal scores, and context features.
* **OUTPUT:** `SecurityActionType` (`ALLOW`, `WARN`, `REQUEST_VERIFICATION`, `RESTRICT`, `BLOCK`, `HUMAN_REVIEW`).
* **LIMITATION:** Must be configured to match the regulatory and operational risk appetite of each organization.

### 12. Cryptographic Audit Ledger
* **WHAT:** Tamper-evident sequential SHA-256 hash chain.
* **WHY:** Guarantees cryptographic non-repudiation and detects unauthorized database record alterations.
* **HOW:** $H_n = \text{SHA256}(H_{n-1} \,\|\, \text{CanonicalJSON}(\text{Event}_n))$.
* **INPUT:** Sequential session audit events.
* **OUTPUT:** Cryptographic event hash linking to parent event.
* **LIMITATION:** Tamper-evident, not immutable (cannot prevent deletion, but immediately detects it).

---

## 31. DOCUMENTATION vs. IMPLEMENTATION DISCREPANCY REPORT

During the deep-code audit, the following mismatches between specifications (PRD/HLD) and actual code were identified:

| Item | Documentation Claims | Code Implements | Impact | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Biometric Encryption** | PRD §5.2 claims voiceprints are encrypted at rest with AES-256-GCM. | `app/models/speaker_profile.py` stores 192-d vectors in plaintext (`Vector192`). | Biometric vectors could be read if database is compromised. | Add AES-256 encryption wrapper in `Vector192` column type before production deployment. |
| **VAD Implementation** | HLD mentions Silero VAD neural network. | `app/audio/vad.py` implements an energy-based RMS/ZCR threshold detector. | Lightweight and fast, but less resilient to high-noise environments than Silero. | Document that TrueVoice uses classical energy VAD for low latency, with Silero as a planned upgrade. |
| **Blockchain Immutability**| Marketing materials sometimes reference "blockchain audit log". | `app/audit/chain.py` implements a sequential SHA-256 hash chain in PostgreSQL. | Tamper-evident, but stored in relational DB, not a decentralized ledger. | Accurately describe it in viva as a **cryptographic hash-chained tamper-evident ledger**. |
| **Threshold Calibration** | Some early docs describe 0.75 as the "empirical EER threshold". | `app/config.py` defines 0.75 as a configurable operational threshold. | Misrepresents an operational operating point as universal ground truth. | State truthfully in viva: *0.75 is an operating point threshold that requires channel calibration.* |
