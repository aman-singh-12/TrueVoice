# TrueVoice — Production Backend Architecture & Technical Reference

**AI-Powered Real-Time Voice Integrity & Impersonation Attack Prevention System**  
**Document Version:** 1.2.0-PRODUCTION  
**Compliance Baseline:** PRD v1.1, HLD v1.2, LLD v1.2.0  
**Target Environment:** SIH 2026 Innovation Challenge / Production MVP  

---

## 1. Executive Architecture Summary

TrueVoice is an enterprise-grade voice security and identity intelligence platform designed to detect and mitigate synthetic voice impersonation attacks in real time. Rather than functioning solely as an isolated acoustic deepfake detector, TrueVoice establishes continuous, multi-dimensional risk evaluation across voice authenticity, biometric speaker identity, conversational intent, operational context, and physical acoustic forensics.

The backend is built as a top-down layered architecture:
$$\text{Transport (REST / WebSocket)} \longrightarrow \text{Business Services} \longrightarrow \text{Domain Engines \& Risk PDP} \longrightarrow \text{Infrastructure, ML \& DB}$$

Key operational characteristics include:
- **Streaming Pipeline:** Ingests live PCM16/WAV streams over WebSockets into thread-synchronized circular audio buffers.
- **Initial Analysis Availability Target:** Approximately 2.0 seconds of audio accumulation plus the target processing latency. Subsequent overlapping analysis windows are evaluated every 0.5 seconds, subject to processing capacity.
- **Two-Branch Audio Execution:** Explicitly separates neural feature extraction (ML branch with model-specific normalization) from raw physical acoustic forensics (unaltered 16kHz PCM branch).
- **Multi-Signal Dynamic Risk Fusion:** Fuses five independent signals with dynamic weight re-normalization, compounding multipliers ($\Gamma=1.35$), and asymmetric exponential moving average (EMA) temporal smoothing.
- **Zero-Trust State Machine:** Governs session trust across seven distinct operational states, decoupled from raw risk scores and identity verification.
- **Tamper-Evident SHA-256 Hash-Chained Audit Ledger:** Guarantees cryptographic non-repudiation and tamper detection across all critical session events.

---

## 2. System Goals and Non-Goals

### System Goals
1. **Real-Time Latency Target:** Process overlapping 2.0s audio windows with an internal inference and evaluation target latency of $\le 120\text{ ms}$ per 0.5s hop under simulated/mock mode.
2. **Defensive Decoupling:** Enforce strict separation between Identity (Biometric), Voice Authenticity (Deepfake/Forensics), and Trust State (State Machine).
3. **Multi-Tenant Isolation:** Ensure complete data segregation by indexing all sessions, profiles, policies, and audit logs by `org_id`.
4. **Resilient Signal Handling:** Dynamically re-normalize risk weights when signals (such as speaker profiles or speech transcripts) are unavailable without failing the pipeline.
5. **Deterministic Auditability:** Provide mathematical verification of session audit logs via sequential SHA-256 hash chaining.

### Non-Goals
1. **No Direct Cellular Baseband Interception:** TrueVoice does not tap telecommunication towers or intercept GSM/SS7 signalling directly. All call audio is ingested via standardized PBX/VoIP communication gateways (SIPREC, WebRTC, WebSocket).
2. **No Real-Time Payment Authorization Blocking:** TrueVoice does not execute direct banking clearing; it issues zero-trust policy directives (`ALLOW`, `WARN`, `REQUEST_VERIFICATION`, `RESTRICT`, `BLOCK`, `HUMAN_REVIEW`) consumed by host banking/enterprise workflows.
3. **No External Public Blockchain:** TrueVoice utilizes an in-database, cryptographically chained SHA-256 ledger (`audit_logs`) rather than a public, high-latency distributed blockchain.
4. **No Multiple Heavy Resident Detectors:** Worker memory maintains only the primary deepfake detector resident at runtime.

---

## 3. End-to-End System Architecture

```text
       [Communication Gateway / PBX / WebRTC Client]
                           │
       WebSocket Audio (PCM16) / REST API (JWT/Ticket)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 TrueVoice FastAPI Gateway                   │
│  - JWT Bearer Authentication & 5-min Session WS Tickets     │
│  - Tenant Boundary Enforcement (org_id validation)         │
│  - Correlation ID & PII/PAN Redaction Logging               │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
        Binary Audio Stream            REST API Requests
               │                              │
               ▼                              ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│    Audio Ingestion & DSP    │ │   Business Services Layer   │
│  - PCM16/WAV Decoder        │ │  - SessionService           │
│  - Polyphase FIR Resampler  │ │  - SpeakerService           │
│  - Energy & Noise-Floor VAD │ │  - VerificationService      │
│  - Circular Audio Buffer    │ │  - PolicyService            │
└──────────────┬──────────────┘ │  - AuditService             │
               │                └──────────────┬──────────────┘
      Two-Branch Splitting                     │
        ┌──────┴──────┐                        │
        ▼             ▼                        ▼
 ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐
 │  ML Branch  │ │  Forensics  │ │  Zero-Trust State Machine   │
 │ (Normalized)│ │ (Raw 16kHz) │ │  - 7 States + Exits         │
 └──────┬──────┘ └──────┬──────┘ └─────────────┬───────────────┘
        │               │                      │
        ▼               ▼                      ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│   Signal Extraction Layer    │ │ Declarative Policy Engine   │
│  - Primary Deepfake Detector │ │  - Rule Priority Matcher    │
│  - ECAPA Speaker Verifier    │ │  - Defensive Actions        │
│  - Acoustic Forensics (F0)   │ └─────────────┬───────────────┘
│  - Whisper ASR & Intent Trie │               │
│  - Operational Context Engine│               │
└──────────────┬───────────────┘               │
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│ Multi-Signal Dynamic Fusion  │ │  Tamper-Evident SHA-256     │
│  - 5 Baseline Weights        │ │  Hash-Chained Audit Ledger  │
│  - Dynamic Re-normalization  │ │  H_n = SHA256(H_(n-1) || E) │
│  - Compounding Gamma (1.35)  │ └─────────────┬───────────────┘
│  - Asymmetric EMA Smoothing  │               │
└──────────────┬───────────────┘               │
               │                               │
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│               PostgreSQL 16 + pgvector Storage              │
│  - Multi-tenant relational schema (organizations, sessions) │
│  - 192-dimensional unit voiceprint embeddings (Vector192)   │
│  - Cryptographic audit trail & chronological risk records   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Audio Ingestion & Preprocessing Pipeline

The ingestion pipeline canonicalizes heterogeneous client streams into uniform single-channel 16,000 Hz float32 audio.

```text
Incoming Audio Chunk ──> Decode (PCM16/WAV) ──> Resample (Polyphase FIR to 16kHz) ──> VAD Filter ──> Circular Buffer
```

1. **Decoding (`AudioDecoder`):** Detects RIFF header bytes or extracts signed 16-bit little-endian linear PCM. Samples are mapped from $[-32768, 32767]$ to normalized $[-1.0, 1.0]$ float32.
2. **Resampling (`AudioResampler`):** Utilizes polyphase FIR filtering via `scipy.signal.resample_poly` with up/down integer ratios to eliminate high-frequency aliasing artifacts.
3. **Voice Activity Detection (`VoiceActivityDetector`):** Evaluates short-term frame energy against a moving baseline noise floor ($E_{RMS} > E_{floor} \times 1.8$) to avoid running compute-intensive neural models during extended silences.

---

## 5. Circular Audio Buffer Architecture

The `CircularAudioBuffer` provides thread-synchronized storage for streaming audio with rolling temporal retention:
- **Buffer Capacity:** Default 10.0 to 30.0 seconds ($160,000$ to $480,000$ samples at 16 kHz).
- **Analysis Window ($W$):** 2.0 seconds ($32,000$ samples).
- **Hop Size ($H$):** 0.5 seconds ($8,000$ samples).
- **Thread Safety:** Protected via Python `threading.Lock` to guarantee race-condition-free concurrent writes from WebSocket receiver threads and synchronous window extractions.

---

## 6. Two-Branch Audio Execution Pipeline

To maintain scientific integrity, TrueVoice strictly splits the 2.0s analysis window into two dedicated processing branches:

| Dimension | Branch 1: Acoustic Forensics | Branch 2: ML & Deepfake Inference |
| :--- | :--- | :--- |
| **Audio Treatment** | **Unaltered Raw PCM** (16,000 Hz mono) | **Model-Specific Normalized** |
| **Normalizations** | None. Unaltered amplitude, dynamics, and harmonics. | Peak clamp (-1.0 dBFS) & RMS normalization (-24 dBFS). |
| **Rationale** | Deepfake generation artifacts (phase jitter, F0 jumps, spectral unnaturalness) are easily destroyed or masked by normalization. | Neural acoustic encoders (Wav2Vec 2.0, RawNet2) expect specific energy calibration for numerical stability. |

---

## 7. Primary Deepfake Artifact Detection Engine

The deepfake detection engine computes $S_{df} \in [0.0, 100.0]$, representing the probability of synthetic speech generation.
- **Model Adapter Architecture:** All detectors implement the `DeepfakeDetector` abstract base class with standardized `predict(audio)` contracts.
- **Feature Normalization:** The Wav2Vec 2.0 adapter normalizes input audio to $-24\text{ dBFS}$ target RMS:
  $$\text{Gain} = \frac{10^{-24/20}}{\sqrt{\frac{1}{N} \sum x[i]^2 + 10^{-9}}}, \quad x_{norm} = \text{clip}(x \cdot \text{Gain}, -1.0, 1.0)$$
- **Mock Mode Availability:** In development, CI, and test environments, `MockDeepfakeDetector` generates deterministic synthetic scores based on high-frequency energy ratios without requiring multi-gigabyte neural checkpoints.

---

## 8. Deepfake Model Selection & Registry

The `DetectorRegistry` singleton coordinates deepfake detector lifecycle:
- **Startup Guarantee:** Initializes and keeps resident in memory **ONLY ONE** primary detector (configured via `DEEPFAKE_PRIMARY_DETECTOR` or `TRUEVOICE_ML_MODE`).
- **Memory Footprint:** Prevents concurrent loading of Wav2Vec 2.0, RawNet2, and AASIST, containing memory consumption under $1.5\text{ GB}$ per worker process.

---

## 9. Speaker Verification & Biometric Identity Engine

Speaker verification (Branch 2) evaluates whether the live audio matches an enrolled voiceprint for the claimed identity:
- **Embedding Space:** 192-dimensional unit-hypersphere embedding vector derived from ECAPA-TDNN.
- **Centroid Enrollment:** Computes normalized centroid across $K$ enrollment audio samples:
  $$v_{centroid} = \frac{\sum_{k=1}^K v_k}{\|\sum_{k=1}^K v_k\|_2}$$
- **Normalized Geometric Similarity:** Computes cosine similarity between live chunk embedding $e_{live}$ and enrolled centroid $e_{profile}$:
  $$S_{speaker} = \frac{1 + \cos(e_{live}, e_{profile})}{2} = \frac{1 + \frac{e_{live} \cdot e_{profile}}{\|e_{live}\|_2 \|e_{profile}\|_2}}{2} \in [0.0, 1.0]$$
- **Signal Decoupling:** Evaluates identity matching only. Does not evaluate synthetic audio artifacts.

---

## 10. Acoustic Forensics Engine (Signal Analysis)

The forensics engine extracts physical acoustic features from unaltered audio:
1. **Fundamental Frequency ($F_0$) Tracking:** Normalized autocorrelation pitch lag search within $[60\text{ Hz}, 450\text{ Hz}]$ to detect unnatural pitch step discontinuities ($>50\text{ Hz}$).
2. **Local Jitter:** Cycle-to-cycle pitch period perturbation:
   $$\text{Jitter}_{local} = \frac{\frac{1}{N-1} \sum_{i=1}^{N-1} |T_i - T_{i+1}|}{\frac{1}{N} \sum_{i=1}^N T_i}$$
3. **Local Shimmer:** Cycle-to-cycle peak amplitude perturbation:
   $$\text{Shimmer}_{local} = \frac{\frac{1}{N-1} \sum_{i=1}^{N-1} |A_i - A_{i+1}|}{\frac{1}{N} \sum_{i=1}^N A_i}$$
4. **Harmonics-to-Noise Ratio (HNR):** Ratio of periodic signal energy to non-harmonic noise expressed in decibels.
5. **Spectral Flatness & Flux:** Wiener entropy (geometric mean divided by arithmetic mean of power spectrum) and spectral frame-to-frame flux.

**Decoupling Principle:** Raw acoustic measurements are preserved in the `features` dictionary for explainability, while the anomaly score $S_{forensic}$ is computed via a configurable heuristic baseline layer.

---

## 11. Speech-to-Text & Conversational Threat Intelligence

- **Speech Recognition:** Powered by `faster-whisper` (or deterministic `MockSpeechRecognizer` in test mode) returning transcribed text tokens.
- **Intent Analysis:** Scans sliding transcripts against a compiled regex intent trie detecting social engineering tactics:
  - `AUTHORITY_CLAIM` (Weight 0.25): Executive impersonation keywords (CEO, Director, Board).
  - `FINANCIAL_URGENCY` (Weight 0.35): Wire transfer, RTGS, immediate clearing.
  - `CREDENTIAL_REQUEST` (Weight 0.40): OTP solicitation, password, MFA bypass.
  - `CHANNEL_SUPPRESSION` (Weight 0.30): "Do not call back", "my battery is dying", "keep this between us".
- **Score Output:** $S_{conv} = \min\left(1.0, \sum w_i\right) \in [0.0, 1.0]$.

---

## 12. Operational Context & Metadata Engine

Evaluates communication metadata and transactional context:
- Features include transaction amount, off-hours execution, new beneficiary status, and caller ANI verification against profile.
- Note: Caller ANI is gateway-provided metadata from SIP headers, not a direct cellular intercept.
- Output: Context sensitivity score $S_{context} \in [0.0, 1.0]$.

---

## 13. Multi-Signal Dynamic Risk Fusion Engine

Combines the five independent intelligence signals into a unified continuous risk score $R_{raw} \in [0.0, 100.0]$.

### Baseline Signal Weights
$$\sum_{i=1}^5 w_i = 1.0$$
- $w_{df} = 0.35$ (Deepfake Artifacts)
- $w_{speaker} = 0.25$ (Biometric Identity Mismatch)
- $w_{conv} = 0.15$ (Conversational Social Engineering Threat)
- $w_{context} = 0.15$ (Operational Context & Transaction Sensitivity)
- $w_{forensic} = 0.10$ (Acoustic Forensics)

---

## 14. Temporal Risk Smoothing & Attack Memory (Asymmetric EMA)

To prevent transient noise from causing alert flickering while guaranteeing rapid response to synthetic voice attacks, TrueVoice applies an **Asymmetric Exponential Moving Average (EMA)**:

$$R_{smoothed}^{(t)} = \alpha \cdot R_{raw}^{(t)} + (1 - \alpha) \cdot R_{smoothed}^{(t-1)}$$

$$\alpha = \begin{cases} \alpha_{attack} = 0.60 & \text{if } R_{raw}^{(t)} > R_{smoothed}^{(t-1)} \\ \alpha_{decay} = 0.20 & \text{if } R_{raw}^{(t)} \le R_{smoothed}^{(t-1)} \end{cases}$$

- **Attack Response ($\alpha=0.60$):** Escalates within 1 to 2 hops upon attack detection.
- **Decay Memory ($\alpha=0.20$):** Maintains defensive posture even if an attacker briefly pauses speaking or drops synthetic audio for one hop.

---

## 15. Dynamic Weight Re-normalization

When one or more signals are unavailable (e.g., when a caller has not enrolled a voiceprint, making speaker verification `UNAVAILABLE`, or speech recognition is pending), weights dynamically renormalize across the active signals:

$$w_k' = \frac{w_k}{\sum_{j \in \mathcal{A}} w_j} \quad \forall k \in \mathcal{A}$$

$$\sum_{k \in \mathcal{A}} w_k' \equiv 1.0$$

This prevents missing signals from artificially depressing the composite risk score.

---

## 16. Non-Linear Compounding Risk Multiplier ($\Gamma=1.35$)

When concurrent high-risk indicators are detected simultaneously—specifically when synthetic voice artifacts are high ($S_{df} \ge 70.0$) **AND** either biometric mismatch occurs ($S_{speaker} \le 0.50$) or high conversational threat is detected ($S_{conv} \ge 0.70$)—a non-linear compounding multiplier is applied:

$$R_{compounded} = \min\left(100.0, \; R_{linear} \times \Gamma\right) \quad (\Gamma = 1.35)$$

This accurately reflects that dual anomalies are characteristic of targeted spear-phishing attacks.

---

## 17. Signal Availability Matrix & Missing-Signal Handling

| Signal | Source | Available Condition | Unavailable Behavior |
| :--- | :--- | :--- | :--- |
| **$S_{df}$** | Deepfake Model | Audio buffer contains $\ge 2.0\text{s}$ speech | Mark `UNAVAILABLE`; renormalize remaining weights. |
| **$S_{speaker}$** | ECAPA-TDNN | Claimed speaker profile enrolled | Mark `UNAVAILABLE`; $w_{speaker}=0$; weight re-distributed. |
| **$S_{forensic}$** | Acoustic Forensics | Raw audio buffer $\ge 800$ samples | Mark `AVAILABLE` with baseline 0 anomaly score. |
| **$S_{conv}$** | Whisper + Intent Trie | Valid speech transcript generated | Mark `UNAVAILABLE` when silence/noise; renormalize. |
| **$S_{context}$** | Session Metadata | Session initialized with metadata | Always `AVAILABLE`. |

---

## 18. Declarative Security Policy Engine

The Policy Decision Point (PDP) deterministically maps composite risk and context features into security actions:

```text
Composite Risk & Context ──> Declarative Policy Engine ──> Security Action & Target State
```

1. **Critical Threat ($R \ge 80.0$ or $S_{df} \ge 0.85$):**
   - Action: `BLOCK`
   - State Transition: $\longrightarrow$ `BLOCKED`
2. **High Sensitivity / Executive Anomaly ($R \ge 50.0$ + Executive Claim):**
   - Action: `HUMAN_REVIEW`
   - State Transition: $\longrightarrow$ `HUMAN_REVIEW`
3. **Elevated Risk ($R \ge 60.0$ or $S_{conv} \ge 0.70$):**
   - Action: `REQUEST_VERIFICATION` (if currently in `OBSERVING` / `CAUTION` / `TRUSTED`) $\longrightarrow$ `VERIFYING`
   - Action: `RESTRICT` (if verification already failed) $\longrightarrow$ `RESTRICTED`
4. **Moderate Risk ($R \ge 30.0$):**
   - Action: `WARN`
   - State Transition: $\longrightarrow$ `CAUTION`
5. **Low Risk ($R < 30.0$):**
   - Action: `ALLOW`
   - State Transition: $\longrightarrow$ `TRUSTED` (if baseline passed)

---

## 19. Zero-Trust Identity State Machine

Tracks session trust lifecycle across seven primary states plus `TERMINATED`:

```text
                ┌───────────────┐
                │   OBSERVING   │
                └──┬────┬────┬──┘
         Low Risk  │    │    │ Moderate Risk
         Verified  │    │    │
                   ▼    │    ▼
       ┌─────────────┐  │  ┌─────────────┐
       │   TRUSTED   │  │  │   CAUTION   │
       └──────┬──────┘  │  └──────┬──────┘
              │         │         │ Step-Up Triggered
              │ High    │ High    ▼
              │ Risk    │ Risk ┌─────────────┐
              │         └─────>│  VERIFYING  │
              │                └──────┬──────┘
              │         Failed / Timeout│ Success
              │                ┌──────┴──────┐
              │                ▼             ▼
              │       ┌─────────────┐ ┌─────────────┐
              └──────>│ RESTRICTED  │ │   TRUSTED   │
                      └──────┬──────┘ └─────────────┘
                Critical     │
                Risk         ▼
                      ┌─────────────┐
                      │   BLOCKED   │
                      └──────┬──────┘
                   Override  │
                             ▼
                      ┌─────────────┐
                      │HUMAN_REVIEW │
                      └──────┬──────┘
         Analyst Exits:      │
         - ANALYST_APPROVE ──┼──> TRUSTED
         - ANALYST_RESTRICT ─┼──> RESTRICTED
         - ANALYST_BLOCK ────┴──> BLOCKED
```

### State Machine Invariants
1. `BLOCKED` cannot transition directly to `TRUSTED` without human analyst override.
2. `TERMINATED` is an absolute terminal state; no transitions are permitted once a session ends.
3. Illegal transitions reject with `InvalidStateTransitionException` (HTTP 409).

---

## 20. Secondary Verification & Step-Up Authentication

- **Protocol:** Out-of-band (OOB) push or in-band cryptographic challenge.
- **Nonce Entropy:** 128-bit cryptographic random nonce generated via `secrets.token_urlsafe(16)`.
- **Challenge Lifetime (TTL):** Strictly bounded to 30 seconds.
- **Anti-Replay Enforcement:** Challenges transition to `SUCCESS`, `TIMEOUT`, or `REJECTED` upon first terminal evaluation and cannot be reused.
- **Rate Limiting:** Maximum 3 verification attempts per challenge before enforcement of `REJECTED`.

---

## 21. Tamper-Evident SHA-256 Hash-Chained Audit Ledger

Every security-sensitive state change, risk assessment, verification event, and analyst override is recorded in an in-database cryptographic hash chain:

$$H_0 = \text{"0"} \times 64$$

$$H_n = \text{SHA256}\left(H_{n-1} \;\|\; \text{CanonicalJSON}\left(\text{Event}_n\right)\right)$$

### Canonical JSON Representation
To prevent hash discrepancies caused by JSON key ordering or whitespace:
- Keys are sorted alphabetically (`sort_keys=True`).
- Separators are stripped of whitespace (`(',', ':')`).
- UTF-8 encoding is strictly enforced.

### Mathematical Verification Endpoint
`GET /v1/audit/{session_id}/verify-chain` iterates sequentially across records $1 \dots N$, recomputing $H_n$ from stored event payloads and verifying $prev\_hash_{n} == H_{n-1}$. Any modified, injected, or deleted record immediately exposes the exact corrupted sequence ID.

---

## 22. Database Architecture & Schema Design (PostgreSQL 16 + pgvector)

All database entities are defined in SQLAlchemy 2.0 and managed exclusively through Alembic migrations (`backend/alembic/versions/001_initial_schema.py`).

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  organizations  │1     *│      users      │       │    policies     │
│  - id (UUID)    ├───────┤  - id (UUID)    │       │  - id (UUID)    │
│  - tenant_code  │       │  - org_id (FK)  │       │  - org_id (FK)  │
└────────┬────────┘       │  - role         │       └─────────────────┘
         │                └─────────────────┘
         │1
         │*
┌────────┴────────┐       ┌─────────────────┐
│ speaker_profiles│1     *│voiceprint_embed │
│  - id (UUID)    ├───────┤  - id (UUID)    │
│  - org_id (FK)  │       │  - embedding    │ 192-d Vector
│  - display_name │       │    (Vector192)  │
└────────┬────────┘       └─────────────────┘
         │1
         │*
┌────────┴────────┐       ┌─────────────────┐
│  call_sessions  │1     *│risk_assessments │
│  - id (UUID)    ├───────┤  - id (UUID)    │
│  - org_id (FK)  │       │  - composite    │
│  - trust_state  │       └─────────────────┘
│  - peak_risk    │1     *┌─────────────────┐
│                 ├───────┤   audit_logs    │
│                 │       │  - prev_hash    │ SHA-256 Chain
│                 │       │  - event_hash   │
│                 │       └─────────────────┘
│                 │1     *┌─────────────────┐
│                 └───────┤verif_events     │
│                         │  - nonce, token │
└─────────────────────────┘└─────────────────┘
```

---

## 23. Tenant Isolation & Multi-Tenancy Security Model

1. **Mandatory Tenant Scoping:** Every query against sessions, speakers, policies, or audit logs strictly asserts `where(Entity.org_id == current_user.org_id)`.
2. **Role-Based Access Control (RBAC):**
   - `OPERATOR`: Access to active session monitoring and verification challenges.
   - `SECURITY_ANALYST`: Authorization to execute human review overrides and inspect forensic telemetry.
   - `ORG_ADMIN`: Authority to configure organizational policy thresholds and manage users.
   - `FORENSIC_AUDITOR`: Read-only access to audit logs and cryptographic chain verification endpoints.
3. **Cross-Tenant Prevention:** Attempts to access resources belonging to a foreign tenant raise `TenantAccessViolation` (HTTP 403 Forbidden).

---

## 24. WebSocket Protocol & Streaming Contract

### Streaming Ingestion Endpoint
`ws://host:8000/v1/stream/{session_id}?token={ticket_token}`

### Authentication
Requires a short-lived (5-minute), session-scoped ticket token obtained via `POST /v1/auth/session-token`. Long-lived JWT access tokens are never transmitted in URL query strings.

### Client Handshake
```json
{
  "type": "HANDSHAKE",
  "sample_rate": 16000,
  "channels": 1,
  "format": "pcm16"
}
```

### Server Telemetry Broadcast Frame
```json
{
  "type": "TELEMETRY",
  "session_id": "8c5a4d2e-3f1b-4987-a612-e567b1234a90",
  "sequence_id": 4,
  "timestamp": "2026-09-18T12:00:02.120Z",
  "risk_score": 72.4,
  "risk_tier": "HIGH",
  "trust_state": "VERIFYING",
  "breakdown": {
    "deepfake": 68.5,
    "speaker_similarity": 0.35,
    "forensic_anomaly": 45.2,
    "conversational_threat": 70.0,
    "context_sensitivity": 35.0
  },
  "provenance": {
    "deepfake": {"model_name": "wav2vec2", "version": "v1.2.0", "weight": 0.35},
    "speaker": {"model_name": "ecapa-tdnn", "version": "v1.0", "weight": 0.25}
  },
  "security_action": "REQUEST_VERIFICATION",
  "detected_intents": ["AUTHORITY_CLAIM", "FINANCIAL_URGENCY"],
  "transcript_snippet": "This is CEO Verma, immediately transfer 50 lakhs before banking closes..."
}
```

---

## 25. REST API Specifications & Error Handling

| Method | Path | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | System health check and detector status | Public |
| `POST` | `/v1/auth/login` | Authenticate user credentials & issue JWT | Public |
| `POST` | `/v1/auth/session-token` | Issue short-lived 5-min WS streaming ticket | Authenticated |
| `GET` | `/v1/auth/me` | Retrieve authenticated user context | Authenticated |
| `POST` | `/v1/sessions` | Initialize new voice interaction session | Operator, Analyst, Admin |
| `GET` | `/v1/sessions` | List sessions for current tenant | Authenticated |
| `GET` | `/v1/sessions/{id}` | Get session details and peak risk | Authenticated |
| `POST` | `/v1/sessions/{id}/terminate`| Conclude and terminate session | Authenticated |
| `POST` | `/v1/sessions/{id}/override` | Submit human analyst review decision | Analyst, Admin |
| `POST` | `/v1/speakers/enroll` | Enroll biometric speaker profile & voiceprint| Analyst, Admin |
| `GET` | `/v1/speakers` | List enrolled speaker profiles | Authenticated |
| `POST` | `/v1/verification/dispatch` | Dispatch OOB secondary challenge | Authenticated |
| `POST` | `/v1/verification/verify` | Submit secondary challenge response proof | Authenticated |
| `GET` | `/v1/risk/{id}/timeline` | Retrieve chronological risk history | Authenticated |
| `GET` | `/v1/policies` | Get active organizational policy rules | Authenticated |
| `POST` | `/v1/policies` | Create or update tenant policy rules | Admin |
| `GET` | `/v1/audit/{id}/logs` | Retrieve sequential audit ledger entries | Analyst, Auditor, Admin |
| `GET` | `/v1/audit/{id}/verify-chain`| Execute cryptographic chain verification | Analyst, Auditor, Admin |

### Standardized Error Format
```json
{
  "detail": "Cannot transition from BLOCKED to TRUSTED: Not permitted by Zero-Trust State Machine rules.",
  "error_code": "INVALID_STATE_TRANSITION",
  "details": {
    "current_state": "BLOCKED",
    "attempted_state": "TRUSTED"
  }
}
```

---

## 26. Worker Lifecycle & ML Model Memory Management

- **Worker Startup:** In the FastAPI lifespan handler, `DetectorRegistry` loads weights for the designated primary detector into resident worker memory once.
- **Worker Shutdown:** Gracefully closes database connection pool engines via `async_engine.dispose()`.
- **Session Cleanup:** As WebSocket sessions terminate or disconnect, `AudioService.cleanup_session(session_id)` purges in-memory circular audio buffers and sliding engines, preventing memory leaks.

---

## 27. Production Deployment Architecture & Docker Configuration

### Dockerfile Highlights
- Base image: `python:3.11-slim`
- Operating packages: `build-essential`, `libsndfile1`, `ffmpeg` for high-throughput audio resampling.
- Security: Runs under non-privileged system user `truevoice` (UID 1000).

### Docker Compose Service Topology
- `truevoice-db`: PostgreSQL 16 with `pgvector` extension, health checks, persistent volume.
- `truevoice-backend`: Auto-applies Alembic migrations (`alembic upgrade head`) before launching Uvicorn workers.

---

## 28. Verification, Testing & Benchmark Methodology

The test suite validates architectural guarantees through comprehensive unit and integration tests (`pytest`):
- **DSP & Ingestion (`test_audio_dsp.py`):** Tests PCM16 decoding, FIR polyphase resampling, VAD energy filtering, and thread-synchronized circular buffer two-branch extraction.
- **Acoustic Forensics (`test_forensics.py`):** Validates autocorrelation pitch tracking, cycle perturbation, and feature decoupling.
- **Risk Fusion (`test_risk_fusion.py`):** Validates dynamic weight re-normalization across missing signals, compounding multiplier ($\Gamma=1.35$), and asymmetric EMA attack response.
- **State Machine (`test_state_machine.py`):** Asserts valid transitions, illegal state transition prevention, and analyst review exits.
- **Audit Ledger (`test_audit_chain.py`):** Asserts hash chaining mathematical accuracy and tamper detection upon record alteration.
- **Secondary Verification (`test_verification_oob.py`):** Asserts 30s TTL expiration and anti-replay protection.
- **API Integration (`test_api_endpoints.py`):** End-to-end testing of authentication, session lifecycle, policy enforcement, challenge-response, and audit verification.

---

## 29. SIH 2026 Evaluation Alignment & Defense Strategy

| SIH Evaluation Criteria | TrueVoice Architectural Demonstration |
| :--- | :--- |
| **Real-Time Feasibility** | 2.0s window / 0.5s hop processing target with circular buffering and thread pool offloading. |
| **Beyond Toy Detection** | Five-signal dynamic fusion (Deepfake + Biometrics + Intent + Context + Forensics) rather than single-model inference. |
| **Enterprise Integration** | REST & WebSocket streaming interfaces conforming to standard enterprise PBX and contact center architectures. |
| **Zero-Trust Principles** | Explicit 7-state Zero-Trust state machine with step-up verification and analyst human review exits. |
| **Compliance & Evidentiary Value** | Tamper-evident SHA-256 hash-chained audit ledger providing verifiable provenance for court and regulatory defense. |
