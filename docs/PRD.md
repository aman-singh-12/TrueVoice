# TrueVoice: AI-Powered Real-Time Voice Integrity & Impersonation Attack Prevention System
## Product Requirements Document (PRD) — Version 1.1 (Audited & Scope-Aligned)

---

### Document Metadata
* **Product Name:** TrueVoice
* **Product Type:** Real-Time Voice Security & Identity Intelligence Platform
* **Competition:** Smart India Hackathon 2026
* **Problem Statement:** SIH 26104 — AI-Powered Real-Time Detection and Prevention of Voice Cloning Impersonation Attacks
* **Organization:** All India Council for Technical Education (AICTE) — Cyber Security Cell
* **Category:** Software
* **Theme:** Blockchain & Cybersecurity
* **Document Version:** 1.1 (Audited & Scope-Aligned)
* **Status:** Approved Baseline Product Definition

---

# 1. Executive Summary

TrueVoice is an AI-powered, real-time voice security and identity intelligence platform designed to detect and prevent **voice cloning, synthetic speech, speaker impersonation, and voice-driven social-engineering attacks** during live or near-live communication.

Modern generative AI systems can clone a person's voice from a short reference audio sample. Threat actors exploit these synthetic voices to impersonate executives, government officials, employees, customers, or family members to manipulate victims into executing fraudulent wire transfers, sharing credentials, or disclosing sensitive corporate information.

Traditional security mechanisms—such as caller ID, voice familiarity, manual callbacks, or basic knowledge-based authentication—are increasingly vulnerable against sophisticated AI-generated voices.

The SIH problem statement specifically calls for an AI-driven framework capable of:
1. Analyzing live or near-live voice streams.
2. Detecting synthetic or cloned speech characteristics.
3. Verifying speaker identity against known voice profiles.
4. Producing an actionable dynamic impersonation risk score.
5. Providing timely alerts and security policy recommendations before sensitive actions are executed.
6. Protecting sensitive biometric data and user privacy.
7. Supporting multilingual environments with diverse Indian accents and dialects.

TrueVoice satisfies these requirements through an **end-to-end multi-signal voice security architecture**:

```text
Incoming Voice Interaction
        ↓
Communication Gateway (WebSocket / Audio Ingestion)
        ↓
Real-Time Audio Processing (16kHz Mono Resampling, Silero VAD, Two-Branch Buffer)
        ↓
AI Voice Intelligence Layer
        ├── Voice Deepfake Detection (Wav2Vec2 / WavLM Speech Representations)
        ├── Speaker Verification (ECAPA-TDNN 192-d Embeddings)
        ├── Acoustic & Signal Forensics (F0, Jitter, Shimmer, HNR)
        ├── Speech Transcription (faster-whisper INT8 Streaming ASR)
        └── Conversational Intent Analysis (Social-Engineering & Threat Extraction)
        ↓
Context & Behavioral Intelligence (Transaction Sensitivity, Beneficiary Novelty, Role Tier)
        ↓
TrueVoice Risk Intelligence Engine (Multi-Signal Dynamic Fusion & Temporal Smoothing)
        ↓
Trust State Machine & Declarative Policy Engine
        ↓
┌──────────────┬────────────────┬───────────────────────────┬─────────────────────┐
│   Continue   │  Warn/Monitor  │ Out-of-Band Verification  │ Restrict / Terminate│
└──────────────┴────────────────┴───────────────────────────┴─────────────────────┘
        ↓
Tamper-Evident Cryptographic Audit Layer (In-Database SHA-256 Hash Chain)
```

### Core Product Principle
> **TrueVoice does not merely ask "Is this voice fake?" It asks: "Can this voice interaction be trusted, who is actually speaking, what are they asking for, and what security action should be taken?"**

---

# 2. Problem Definition & Threat Landscape

### 2.1 The Threat
Advances in generative AI, neural speech synthesis, voice conversion, and few-shot voice cloning allow adversaries to synthesize human voices with minimal reference audio. These capabilities enable:
* Executive and CEO impersonation for unauthorized treasury fund transfers.
* Government official impersonation to demand privileged data.
* Employee impersonation to bypass internal helpdesk verification.
* Financial social engineering (solicitation of OTPs, passwords, or beneficiary modifications).

### 2.2 Attack Vectors Addressed
* **Neural Voice Cloning:** Synthetic speech generated via neural vocoders and parametric/diffusion TTS.
* **Voice Conversion (VC):** Real-time vocal tract conversion mapping an attacker's live speech to a victim's voice.
* **Spliced & Replay Attacks:** Pre-recorded authentic audio clips replayed through loudspeakers or soundboards.
* **Social-Engineering Pretexting:** Genuine voice used in high-pressure, urgent, or coercive requests.
* **Human Impersonation:** Callers falsely claiming privileged identity without AI manipulation.

---

# 3. Product Vision & Architecture Hierarchy

### 3.1 Vision Statement
To establish a reusable, zero-trust voice security layer that continuously evaluates **voice authenticity, speaker identity, conversational intent, and interaction context** to protect organizations before high-consequence actions are executed.

### 3.2 Documentation Hierarchy
To maintain strict architectural discipline across the TrueVoice engineering lifecycle, documentation is partitioned into three distinct layers:
* **PRD (Product Requirements Document — WHAT & WHY):** Defines user personas, product capabilities, security requirements, functional boundaries, and success criteria.
* **HLD (High-Level Design — HIGH-LEVEL HOW):** Defines subsystem architecture, streaming topologies, asynchronous worker design, component relationships, and data flows.
* **LLD (Low-Level Design — EXACT IMPLEMENTATION HOW):** Defines concrete classes, function signatures, database DDL, API contracts, mathematical weighting formulas, and file structures.

---

# 4. Product Scope: MVP vs. Future Enterprise Evolution

TrueVoice maintains a strict boundary between the **SIH 2026 Working Prototype (MVP)** and the **Future Enterprise Roadmap**.

```text
┌─────────────────────────┬──────────────────────────────────┬───────────────────────────────────────┐
│ Feature Area            │ Phase 1: SIH MVP Scope           │ Phase 2: Future Enterprise Evolution  │
├─────────────────────────┼──────────────────────────────────┼───────────────────────────────────────┤
│ Telephony Ingestion     │ WebSocket streaming, simulated   │ Carrier-grade SIP/RTP trunking        │
│                         │ WebRTC clients, audio file test  │ (Kamailio / Asterisk PBX integration) │
│ Preprocessing           │ Backend 16kHz FIR downsampling,  │ Hardware DSP acceleration, dedicated  │
│                         │ Silero VAD, two-branch buffer    │ neural speech enhancement             │
│ Deepfake Detection      │ Fine-tuned Wav2Vec2 / WavLM head │ Multi-model ensemble (WavLM + AASIST) │
│ Speaker Verification    │ ECAPA-TDNN 192-d embeddings,     │ Multi-session centroid adaptation,    │
│                         │ normalized cosine similarity     │ cross-lingual vocal tract modeling    │
│ Signal Forensics        │ DSP F0, Jitter, Shimmer, HNR     │ Room impulse response cross-channel   │
│ Speech Transcription    │ faster-whisper INT8 (En / Hi)    │ Multilingual IndicConformer (12+ Lang)│
│ Conversational Intent   │ Regex trie + lightweight NLP     │ Fine-tuned LLM security co-pilot      │
│ Context Analysis        │ Rule-based metadata evaluator    │ Enterprise IAM / ERP behavioral graph │
│ Risk Architecture       │ In-process async coordinator     │ Distributed Redis Streams worker pool │
│ Policy & Security Action│ Declarative threshold evaluator, │ Direct ISO 20022 banking API lock,    │
│                         │ simulated UI workflow lock       │ automated carrier call drop           │
│ Secondary Verification  │ Simulated out-of-band push       │ FIDO2 / WebAuthn mobile secure enclave│
│                         │ challenge with signed nonce      │ biometric hardware challenge          │
│ User Interfaces         │ Next.js 14 Web Security Console  │ Dedicated Mobile App, Native Softphone│
│ Integration APIs        │ REST APIs + Real-Time WebSocket  │ Full Enterprise SDKs & gRPC endpoints │
│ Audit Ledger            │ In-database SHA-256 hash chain   │ Periodic Consortium Blockchain Anchor │
│ Deployment Model        │ Docker Compose (Single Instance) │ Multi-AZ Kubernetes with KEDA autoscal│
└─────────────────────────┴──────────────────────────────────┴───────────────────────────────────────┘
```

---

# 5. Non-Goals (Explicit Product Boundaries)

The following capabilities are explicitly **out of scope**:
* **Direct Cellular Call Tapping:** TrueVoice does not intercept raw SS7 or cellular network carrier calls without carrier gateway hardware integration.
* **100% Unconditional Accuracy Guarantees:** No AI model can guarantee detection of every zero-day voice synthesis method; TrueVoice enforces defense-in-depth and verification workflows.
* **Direct Bank Account or Ledger Manipulation:** TrueVoice does not directly debit, credit, or freeze core banking ledgers; it triggers application-level workflow locks and simulated transaction holds.
* **Permanent Raw Audio Repository:** TrueVoice does not retain unencrypted, raw conversational audio for operational archival.
* **Psychological or Lie Detection:** The platform detects acoustic synthesis artifacts and social-engineering keywords; it does not claim to measure stress or deceptive intent.

---

# 6. Target Users & Personas

### 6.1 Frontline Operator / Finance Officer
* **Context:** Receives calls requesting sensitive actions (e.g., wire transfers, privileged account changes).
* **Needs:** Simple, unobtrusive risk indicators, clear warnings, and automatic disabling of high-risk buttons when an interaction is unverified.
* **Experience:** Green/Yellow/Red visual shield with actionable guidance (e.g., *"Verification in flight — Wire transfer disabled"*).

### 6.2 Security Operations Center (SOC) Analyst
* **Context:** Investigates suspicious calls and flagged impersonation attempts.
* **Needs:** Comprehensive technical telemetry, radar charts (synthetic score, speaker similarity, acoustic anomalies, conversational urgency), verbatim transcripts, and incident timelines.

### 6.3 Enterprise Administrator
* **Context:** Manages organization security policies and protected identities.
* **Needs:** Biometric speaker enrollment for high-profile executives, declarative risk threshold configuration, role-based access control (RBAC), and compliance audit trail exports.

### 6.4 External Systems (API Consumer)
* **Context:** Integrated enterprise CRM, simulated softphone, or treasury approval portal.
* **Needs:** Low-latency WebSocket telemetry streams, REST session creation endpoints, and webhook notifications on risk state transitions.

---

# 7. Core Product Concepts

### 7.1 Separation of Identity, Risk, and Trust Dimensions
TrueVoice strictly maintains three independent operational dimensions:

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. IDENTITY DIMENSION: "Who is speaking?"                                       │
│    • UNVERIFIED : No enrolled profile match or speaker mismatch.                │
│    • VERIFIED   : Incoming voice matches enrolled biometric voiceprint.         │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2. RISK DIMENSION: "What is the intensity of detected threat signals?"          │
│    • LOW (0 - 29)      : No Significant Risk Detected (Nominal baseline).       │
│    • MODERATE (30 - 59): Caution (Elevated telemetry sampling).                 │
│    • HIGH (60 - 79)    : Enhanced Verification Required (Step-up challenge).    │
│    • CRITICAL (80 - 100): Immediate Security Action Required (Workflow lock).   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 3. TRUST STATE DIMENSION: "What is the current session lifecycle state?"        │
│    • OBSERVING   : Active call, nominal monitoring, no privileged actions.      │
│    • CAUTION     : Yellow warning banner displayed to operator.                 │
│    • VERIFYING   : Out-of-band challenge in flight; sensitive actions locked.   │
│    • TRUSTED     : Identity verified + OOB challenge passed + low risk.         │
│    • RESTRICTED  : Challenge timed out / elevated risk; read-only lock active.  │
│    • BLOCKED     : Attack confirmed / critical risk / gateway severed.          │
│    • HUMAN_REVIEW: Conflicting AI signals; held for SOC analyst adjudication.   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Risk Engine vs. Policy Engine Separation
The system enforces a strict functional pipeline:
$$\text{Evidence} \longrightarrow \text{Assessment} \longrightarrow \text{Risk Engine} \longrightarrow \text{Policy Engine} \longrightarrow \text{Security Action}$$
* **Risk Engine:** Evaluates multi-modal evidence to calculate **how risky** the interaction is ($R \in [0, 100]$).
* **Policy Engine:** Evaluates tenant-configured rules against the risk score and context to determine **what action** the organization must execute.

---

# 8. Product Modules & Functional Requirements

## 8.1 Audio Ingestion & Preprocessing
* **FR-ING-01 (Streaming Protocols):** The system shall accept live streaming audio via WebSockets (16-bit linear PCM) and support batch audio file uploads for testing.
* **FR-ING-02 (Sample-Rate Canonicalization):** The backend shall detect incoming client sample rates (e.g., 44.1kHz or 48kHz from browser AudioWorklets) and resample audio to a unified master standard: **16,000 Hz, 16-bit Signed Mono PCM**.
* **FR-ING-03 (Voice Activity Detection):** The system shall filter silence and non-speech background noise using Silero VAD. Audio segments with $<50\%$ speech presence shall bypass deepfake inference while slowly decaying the smoothed risk score.
* **FR-ING-04 (Two-Branch Architecture):** Preprocessed audio shall split into:
  1. *ML-Normalized Branch:* Peak and RMS normalized to $-24\text{ dBFS}$ for neural deepfake and speaker models.
  2. *Minimally Processed Forensic Branch:* Un-normalized raw audio to preserve micro-variations and channel artifacts for DSP forensics.

## 8.2 Voice Deepfake Detection
* **FR-DF-01 (Synthetic Voice Scoring):** The system shall produce a normalized synthetic probability $P_{\text{synth}} \in [0.0, 1.0]$ using a fine-tuned self-supervised representation model (Wav2Vec2 / WavLM).
* **FR-DF-02 (Generalization Requirements):** The deepfake detector shall be evaluated against known vocoders, unseen commercial generators, lossy telephony codecs (Opus, G.711), and acoustic replay conditions.
* **FR-DF-03 (Temporal Smoothing):** Chunk probabilities shall be smoothed using an asymmetric Exponential Moving Average (EMA) ($\alpha = 0.60$ on risk increase, $\alpha = 0.20$ on decay) to prevent alert flickering.

## 8.3 Speaker Verification
* **FR-SV-01 (Enrollment):** The system shall allow authorized administrators to enroll protected speaker identities by submitting reference speech samples to generate a 192-dimensional centroid embedding.
* **FR-SV-02 (Normalized Cosine Similarity):** The system shall calculate the normalized cosine similarity $S_{\text{speaker}} \in [0.0, 1.0]$ between live chunks and reference embeddings:
  $$S_{\text{speaker}} = \max\left(0.0, \min\left(1.0, \frac{\text{CosineSim}(\mathbf{e}_{\text{live}}, \mathbf{e}_{\text{ref}}) + 1.0}{2.0}\right)\right)$$
* **FR-SV-03 (Unenrolled Handling):** If a call does not match an enrolled speaker profile, identity shall be flagged as `UNVERIFIED`. The session shall be prohibited from entering `TRUSTED` state regardless of how low the deepfake score is.
* **FR-SV-04 (Decoupled Authenticity):** The system shall treat speaker verification and deepfake detection as independent signals, acknowledging that replaying a genuine voice sample defeats speaker verification alone.

## 8.4 Acoustic & Signal Forensics
* **FR-AF-01 (DSP Anomaly Extraction):** The system shall extract explainable signal metrics from the raw forensic branch:
  * Fundamental frequency ($F_0$) contour dynamics and unnatural pitch flattening.
  * Local Jitter (cycle-to-cycle frequency variations).
  * Local Shimmer (cycle-to-cycle amplitude variations).
  * Harmonics-to-Noise Ratio (HNR).
* **FR-AF-02 (Heuristic Baselines):** Forensic thresholds shall be treated as configurable heuristic baselines requiring empirical calibration across diverse recording devices.

## 8.5 Speech Recognition & Conversational Intent
* **FR-ASR-01 (Streaming Transcription):** The system shall generate near-real-time transcript tokens using `faster-whisper` INT8.
* **FR-SE-01 (Social-Engineering Detection):** A rule-based regex trie and lightweight classifier shall evaluate sliding transcript windows for:
  * *Urgency/Coercion:* Demands for immediate execution without delay.
  * *Authority Claims:* Assertions of executive or government authority.
  * *Bypass Requests:* Explicit instructions to skip verification or dual-control procedures.
  * *Sensitive Payloads:* Solicitations for OTPs, passwords, wire transfers, or beneficiary modifications.
* **FR-SE-02 (Transcript Privacy):** Transcripts held in volatile memory shall be redacted for PII (credit cards, tax IDs, passwords) prior to persistent storage.

## 8.6 Context Intelligence Engine
* **FR-CTX-01 (Metadata Risk Scoring):** The system shall evaluate operational context without requiring heavy LLM dependencies:
  * Transaction sensitivity (amount $\ge ₹10\text{ Lakh}$ increases risk).
  * Counterparty novelty (new beneficiary accounts).
  * Temporal deviation (off-hours or weekend interaction).
  * Channel consistency (caller ANI/CLI matching registered directory).

## 8.7 Dynamic Risk Engine
* **FR-RSK-01 (Multi-Signal Fusion):** Composite risk $R_{\text{raw}} \in [0, 100]$ shall combine active signals with baseline weights:
  $$R_{\text{raw}} = 100 \cdot \left( w_{\text{df}} S_{\text{df}} + w_{\text{spk}} (1 - S_{\text{spk}}) + w_{\text{conv}} S_{\text{conv}} + w_{\text{context}} S_{\text{context}} + w_{\text{forensic}} S_{\text{forensic}} \right) \cdot \Gamma$$
  Standard weights: $w_{\text{df}} = 0.35, w_{\text{spk}} = 0.25, w_{\text{conv}} = 0.15, w_{\text{context}} = 0.15, w_{\text{forensic}} = 0.10$.
* **FR-RSK-02 (Dynamic Re-Normalization):** If any signal is missing (e.g., claimed speaker is unenrolled, ASR stream fails), the system shall **not** inject an arbitrary pseudo-risk value. Remaining active weights shall re-normalize dynamically.
* **FR-RSK-03 (Non-Linear Compounding):** If synthetic probability is high ($S_{\text{df}} \ge 0.85$) AND conversational threat is elevated ($S_{\text{conv}} \ge 0.70$), a non-linear compounding multiplier ($\Gamma = 1.35$, bounded to max 100) shall trigger immediately.

## 8.8 Policy Engine & Trust State Machine
* **FR-POL-01 (Zero-Trust Lifecycle):** Session transitions shall follow the deterministic state machine: `OBSERVING`, `CAUTION`, `VERIFYING`, `TRUSTED`, `RESTRICTED`, `BLOCKED`, and `HUMAN_REVIEW`.
* **FR-POL-02 (Human Review State Exits):** If AI signals conflict (e.g., high synthetic probability with high speaker match), the session shall enter `HUMAN_REVIEW`. A SOC analyst may execute deterministic resolution actions:
  * `ANALYST_APPROVE` $\longrightarrow$ `TRUSTED`
  * `ANALYST_RESTRICT` $\longrightarrow$ `RESTRICTED`
  * `ANALYST_BLOCK` $\longrightarrow$ `BLOCKED`
* **FR-POL-03 (Workflow Restrictions):** Upon entering `VERIFYING`, `RESTRICTED`, or `BLOCKED` states, the policy engine shall trigger application-level locks (disabling transfer approval buttons in the integrated UI).

## 8.9 Secondary Verification
* **FR-VER-01 (Out-of-Band Challenge):** When risk crosses $\ge 60$ or sensitive actions are requested, TrueVoice shall dispatch an out-of-band verification challenge to the claimed user's trusted device over an independent channel.
* **FR-VER-02 (MVP Simulation vs Future FIDO2):** For the MVP, the challenge shall generate an asynchronous nonce with a 30-second TTL validated via simulated push. Integration with hardware-enclave FIDO2/WebAuthn is preserved as future enterprise architecture.
* **FR-VER-03 (Dynamic Challenge-Response):** The system shall support in-band dynamic phonetic phrases (*"Repeat phrase: Crimson Falcon 19"*). This increases the difficulty of replay and soundboard attacks by requiring immediate dynamic speech generation.

## 8.10 Security Operations Dashboard
* **FR-UI-01 (Real-Time Monitoring):** The Next.js 14 console shall display live calls, dynamic radial risk gauges ($0-100$), Trust State badges, factor radar breakdowns, redacted transcripts, and incident timelines.
* **FR-UI-02 (Action Lock Panel):** The console shall demonstrate simulated transaction locking by dynamically disabling sensitive operational controls when risk escalates.

## 8.11 Tamper-Evident Audit Ledger
* **FR-AUD-01 (In-Database Hash Chaining):** Every security-relevant event shall append a cryptographically chained block to the audit log:
  $$\text{Hash}_i = \text{SHA-256}\left(\text{Hash}_{i-1} \parallel \text{SessionID} \parallel \text{SeqID} \parallel \text{TrustState} \parallel \text{EventType} \parallel \text{Timestamp} \parallel \text{Payload} \parallel \text{ModelVersion}\right)$$
* **FR-AUD-02 (Tamper Evidence):** The database shall provide mathematical proof of non-tampering; any post-hoc modification to a row breaks the subsequent hash chain.
* **FR-AUD-03 (Core Detection Independence):** The audit ledger shall operate entirely inside PostgreSQL without mandatory blockchain dependencies. External blockchain anchoring is retained strictly as an optional post-session notary feature.

---

# 9. Non-Functional Requirements & Engineering Targets

### 9.1 Latency Taxonomy & Preliminary Design Budgets
Latency shall be evaluated across three distinct operational concepts:
1. **Audio Accumulation Latency:** $2.0\text{ seconds}$ fixed window required to collect phonemically meaningful audio chunks.
2. **Detection Update Interval:** $0.5\text{ seconds}$ hop size, providing 2 continuous risk evaluations per second.
3. **Compute Latency (Inference Pipeline):** Preliminary engineering budget targets **$\le 370\text{ ms}$** end-to-end compute time (ingestion to risk broadcast), comfortably under the **$< 450\text{ ms}$** SLA threshold. All latency figures are design targets to be validated empirically on target hardware.

### 9.2 Biometric Privacy & Security
* **NFR-SEC-01 (Ephemeral Buffering):** Audio chunks in memory ring buffers shall be overwritten with zeros and garbage-collected immediately post-feature extraction.
* **NFR-SEC-02 (Embedding Protection):** Speaker embeddings are sensitive biometric-derived data and shall be encrypted at rest (AES-256-GCM), isolated by tenant organization, and governed by strict lifecycle deletion controls.
* **NFR-SEC-03 (Transport Security):** All client-server communication (REST and WebSockets) mandates TLS 1.3 encryption.

### 9.3 Multilingual & Indian-Accent Considerations
* **NFR-LNG-01 (Language-Agnostic Anti-Spoofing):** Acoustic deepfake detection features (neural vocoder artifacts, phase discontinuities) operate largely independently of spoken language.
* **NFR-LNG-02 (Language Coverage Roadmap):** The MVP implements transcription and intent analysis for English and Hindi (including code-switching "Hinglish"). Regional Indian language expansion (Tamil, Telugu, Bengali, Marathi, etc.) is designated as a post-MVP roadmap capability.

---

# 10. Data Model Entities (Conceptual Schema)

The conceptual data model defines the following high-level entities (implemented in PostgreSQL 16 with `pgvector`):
* `Organization`: Multi-tenant boundary and enterprise configuration.
* `User`: System actors (Operator, Security Analyst, Org Admin, Forensic Auditor).
* `SecurityPolicy`: Declarative risk thresholds and action configurations.
* `SpeakerProfile`: Enrolled identity metadata and consent timestamps.
* `VoiceprintEmbedding`: 192-dimensional vector embedding indexed via HNSW cosine distance.
* `ModelVersion`: Deployed AI model digests and version provenance tags.
* `CallSession`: Active or historical monitored communication session.
* `RiskAssessment`: Chunk-level multi-signal telemetry scores and factor breakdowns.
* `ConversationAnalysis`: Rolling redacted transcripts and detected intent flags.
* `VerificationEvent`: Out-of-band push or in-band challenge records and statuses.
* `SecurityAction`: System-enforced or analyst-override operational interventions.
* `AuditLog`: Tamper-evident SHA-256 hash-chained event records.

---

# 11. Open-Source Reference Architecture Strategy

TrueVoice evaluates established open-source projects strictly as **research baselines, architectural references, or modular foundations**, without duplicating functionality or copying monolithic codebases:
* **Tejahudson/voice-cloning-detector:** Informs DSP signal forensics (F0, Jitter, Shimmer, HNR) and sliding-window audio buffering.
* **VAANISHIELD:** Informs ECAPA-TDNN speaker verification and centroid extraction.
* **CallShield:** Informs session state tracking, WebSocket telemetry broadcast structures, and SOC dashboard layout.
* **ASVspoof Consortium:** Informs anti-spoofing feature benchmarks and vocoder artifact validation protocols.
* **Personalised Audio Deepfake Detection:** Informs the conceptual decoupling of speaker identity matching from synthetic voice detection.

---

# 12. Complete MVP End-to-End Demonstration Scenario

The primary SIH demonstration executes the following end-to-end security loop:

```text
1. Attacker calls corporate finance using a synthetic voice cloned from the CEO.
2. The employee receives the call via the TrueVoice-monitored interface.
3. TrueVoice ingests audio over WebSocket, resamples to 16kHz, and applies Silero VAD.
4. The parallel inference coordinator executes deepfake detection, speaker verification,
   acoustic forensics, streaming ASR, and intent analysis via thread pool workers.
5. Telemetry evaluation:
   • Synthetic Voice Probability: 0.84 (High neural vocoder indicators)
   • Speaker Similarity: 0.34 (Mismatch against CFO's enrolled profile)
   • Conversational Intent: High Urgency & Immediate Wire Transfer Request
   • Context Risk: High Value (₹25 Lakh) to an Unrecognized Beneficiary Account
6. Dynamic Risk Engine calculates composite risk score: 86 / 100 (CRITICAL).
7. Trust State Machine transitions: OBSERVING -> VERIFYING -> BLOCKED.
8. Policy Action Engine locks the "Approve Wire Transfer" button in the operator UI.
9. An out-of-band verification challenge is dispatched to the CEO's registered mobile device.
10. The verification challenge times out / is rejected; TrueVoice severing policy triggers.
11. An immutable SHA-256 chained audit record is appended to PostgreSQL.
12. The security analyst inspects the incident timeline and factor radar on the dashboard.
```

---

# 13. Demonstrable MVP Success Criteria

The SIH prototype is accepted when the following capabilities are verified:
* **SC-01 (Synthetic Voice Detection):** Demonstrates detection of AI-cloned voices on representative test samples.
* **SC-02 (Speaker Verification):** Demonstrates biometric matching and mismatch detection against enrolled speaker profiles.
* **SC-03 (Near-Real-Time Risk Scoring):** Demonstrates continuous risk score updates within the sub-450ms compute budget.
* **SC-04 (Conversational & Context Risk):** Demonstrates risk score escalation upon detecting urgent phrases or high-value transfers.
* **SC-05 (Zero-Trust Action Lock):** Demonstrates automated disabling of sensitive workflow actions upon risk escalation.
* **SC-06 (Secondary Verification Flow):** Demonstrates out-of-band verification challenge initiation and timeout/rejection handling.
* **SC-07 (Tamper-Evident Auditability):** Demonstrates in-database SHA-256 hash chaining and proves detection of modified records.
* **SC-08 (Security Operations Console):** Demonstrates live call monitoring, factor radar breakdown, and incident review in Next.js 14.
* **SC-09 (Biometric Privacy Adherence):** Demonstrates that raw audio is purged from memory buffers post-inference.
