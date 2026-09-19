# TrueVoice Risk, Intelligence & Policy Engine Architecture

## 1. Executive Overview & Scope

The **Risk + Intelligence + Policy Engine** constitutes the cognitive decision brain of TrueVoice. Operating on the dedicated feature branch `feature/risk-intelligence`, this system consumes heterogeneous real-time analytical signals, performs independent multi-signal risk fusion, evaluates operational context, extracts conversational threat intelligence, and deterministically executes declarative security policies under a strict Zero-Trust paradigm.

```
+-----------------------------------------------------------------------------+
|                           TRUEVOICE SECURITY BRAIN                          |
|                                                                             |
|  [ Branch 1: Audio Signals ]          [ Branch 2: Contextual & Text Data ]  |
|   + Deepfake (Wav2Vec2/RawNet2)        + Context Metadata (8 Signals)       |
|   + Speaker Verification (ECAPA-TDNN)  + Sliding ASR Transcript (Whisper)   |
|   + DSP Acoustic Forensics (12 Feats)                                       |
|                  \                               /                          |
|                   \                             /                           |
|                    v                           v                            |
|             +-----------------------------------------+                     |
|             | Multi-Signal Risk Fusion Engine         |                     |
|             |  - Explicit Signal Availability Matrix  |                     |
|             |  - Dynamic Weight Renormalization       |                     |
|             |  - Compounding Multiplier (Gamma=1.35)  |                     |
|             |  - Asymmetric EMA Temporal Smoothing    |                     |
|             +-----------------------------------------+                     |
|                                  |                                          |
|                                  v                                          |
|             +-----------------------------------------+                     |
|             | Declarative Policy Decision Point (PDP) |                     |
|             |  - Decoupled Tenant Rules & Thresholds  |                     |
|             |  - Dual Confirmation Anomaly Gate       |                     |
|             |  - Step-Up Verification Enforcement     |                     |
|             |  - Executive Escalation Protection      |                     |
|             +-----------------------------------------+                     |
|                                  |                                          |
|                                  v                                          |
|             +-----------------------------------------+                     |
|             | Zero-Trust State Machine (PEP)          |                     |
|             |  OBSERVING -> CAUTION -> VERIFYING ->   |                     |
|             |  RESTRICTED / BLOCKED / TRUSTED         |                     |
|             +-----------------------------------------+                     |
|                                  |                                          |
|                                  v                                          |
|             +-----------------------------------------+                     |
|             | Tamper-Evident SHA-256 Audit Chain      |                     |
|             +-----------------------------------------+                     |
+-----------------------------------------------------------------------------+
```

---

## 2. Component Architecture & Detailed Design

### Part A: DSP & Acoustic Forensics (`app/forensics/`)
The acoustic forensics subsystem provides deterministic, physical signal measurements to complement statistical neural spoofing models.

- **Feature Decoupling Pipeline:**
  $$\text{Raw PCM16 Audio} \longrightarrow \text{Feature Extraction} \longrightarrow \text{Features Dict} \longrightarrow \text{Scoring & Evidence}$$
  Extracted physical metrics are strictly separated from anomaly thresholds and scoring logic.
- **Physical Feature Set (12 Deterministic Measurements):**
  1. `rms_energy`: Root-mean-square amplitude calculation.
  2. `zcr`: Mean zero-crossing rate across sliding frames.
  3. `mean_f0_hz`: Fundamental pitch frequency contour via autocorrelation.
  4. `max_pitch_jump_hz`: Maximum frame-to-frame pitch discontinuity.
  5. `jitter_local`: Cycle-to-cycle pitch period perturbation.
  6. `shimmer_local`: Peak-to-peak amplitude perturbation.
  7. `hnr_db`: Harmonics-to-Noise Ratio measuring periodic vocal cord vibration vs turbulence.
  8. `spectral_flatness`: Ratio of geometric mean to arithmetic mean of spectral magnitude.
  9. `spectral_flux`: Euclidean distance between successive spectral frames.
  10. `spectral_centroid_hz`: Center of mass of the frequency spectrum.
  11. `spectral_rolloff_hz`: Frequency below which 85% of spectral energy resides.
  12. `energy_distribution`: Tri-band spectral distribution (`low_ratio` <500Hz, `mid_ratio` 500–3000Hz, `high_ratio` >3000Hz).
- **Silence & Unvoiced Handling:**
  Audio chunks with voiced ratio $< 0.10$ or pure zero amplitude return $S_{\text{forensic}} = 0.0$ and are explicitly marked with `signal_availability = SignalAvailability.UNAVAILABLE`, preventing division-by-zero or spurious anomaly alerts.

---

### Part B: Conversational Threat Intelligence (`app/intelligence/intent.py`)
Analyzes real-time transcripts generated by Whisper ASR to identify conversational social engineering attack patterns.

- **9 Structured Threat Categories:**
  1. `AUTHORITY_IMPERSONATION`: Executive, C-suite, legal, or IT support impersonation.
  2. `FINANCIAL_URGENCY`: Tight deadline pressure demanding rapid fund transfers.
  3. `CREDENTIAL_SOLICITATION`: Requests for corporate passwords, master keys, or PINs.
  4. `MFA_OTP_SOLICITATION`: Demands for 6-digit SMS OTPs, Authenticator codes, or push approvals.
  5. `SECURITY_BYPASS`: Coercion to override dual authorization, validation rules, or standard protocols.
  6. `SECRECY_REQUEST`: Demands for strict confidentiality or concealment from colleagues.
  7. `CALLBACK_SUPPRESSION`: Discouraging callback verification or claiming phone failure.
  8. `COERCION_PRESSURE`: Threats of immediate account freezing, disciplinary action, or legal arrest.
  9. `UNUSUAL_PAYMENT_INSTRUCTION`: Alternate routing numbers, gift card vouchers, cryptocurrency.
- **Multi-Indicator Resilience:** Single keywords (such as "OTP" or "transfer") do not trigger threat alerts. Patterns require multi-word contextual phrases.
- **Defensive Speech Suppression:** Security awareness advisories (e.g., "we will never ask for your OTP", "do not share passwords") are automatically detected; when present, threat scores are suppressed.
- **Legacy Compatibility:** Maintains `CATEGORY_ALIASES` (`AUTHORITY_CLAIM`, `CREDENTIAL_REQUEST`, `CHANNEL_SUPPRESSION`) ensuring zero regression across legacy API consumers.

---

### Part C: Operational Context Engine (`app/intelligence/context.py`)
Evaluates transaction metadata, account risk, and environmental factors completely independent of acoustic voice signals.

- **8 Operational Context Signals:**
  1. `amount`: Transaction value assessed against tenant high-value and elevated thresholds.
  2. `is_new_beneficiary`: Transaction directed toward newly enrolled or unverified accounts.
  3. `is_off_hours`: Calls or requests initiated outside tenant operational hours.
  4. `caller_ani_matches`: Caller ID / ANI verified against registered customer directory.
  5. `is_unusual_channel`: Connection originating from non-standard gateways or transports.
  6. `is_privileged_user`: Target account possesses executive or administrative privileges.
  7. `is_sensitive_operation`: High-risk profile changes (e.g. limit increase, MFA reset, device pairing).
  8. `is_unusual_transaction`: Significant deviation from customer historical transaction patterns.
- **Factor Provenance & Decoupling:** Contextual factors reflect operational exposure, not acoustic synthesis. The output contains structured provenance dicts (`type`, `value`, `amount`, `threshold`) for audit trails.
- **Configurable Tenant Thresholds:** Tenant-specific policies customize `high_value_threshold`, `elevated_value_threshold`, and factor penalty weights.

---

### Part D: Multi-Signal Risk Fusion Engine & Temporal Smoothing (`app/risk/`)
Combines 5 disparate signals into a unified security risk score $R_{\text{composite}} \in [0.0, 100.0]$.

- **Signal Availability Matrix:**
  $$\text{Signals} \in \{S_{\text{df}}, S_{\text{speaker}}, S_{\text{conv}}, S_{\text{context}}, S_{\text{forensic}}\}$$
  Unavailable signals are explicitly marked `UNAVAILABLE` and excluded from the fusion calculation. They are never defaulted to safe (0.0) or malicious (1.0).
- **Dynamic Weight Renormalization:**
  Given base weights $W_{\text{base}} = [0.35, 0.25, 0.15, 0.15, 0.10]$:
  $$W'_i = \frac{W_i}{\sum_{j \in \text{Available}} W_j}, \quad \sum_{i \in \text{Available}} W'_i = 1.0$$
- **Compounding Multiplier ($\Gamma = 1.35$):**
  When two independent attack vectors are simultaneously detected (e.g. Deepfake + Speaker Mismatch, or Deepfake + High Conversational Threat), the base risk is compounded by $\Gamma = 1.35$.
- **Asymmetric Exponential Moving Average (EMA):**
  Prevents rapid score oscillation during intermittent silence, background noise, or model jitter:
  $$R_{\text{smoothed}, t} = \alpha \cdot R_{\text{raw}, t} + (1 - \alpha) \cdot R_{\text{smoothed}, t-1}$$
  $$\alpha = \begin{cases} \alpha_{\text{attack}} = 0.60 & \text{if } R_{\text{raw}, t} > R_{\text{smoothed}, t-1} \quad (\text{Rapid Attack Escalation}) \\ \alpha_{\text{decay}} = 0.20 & \text{if } R_{\text{raw}, t} \le R_{\text{smoothed}, t-1} \quad (\text{Cautious Attack Decay}) \end{cases}$$

---

### Part E: Declarative Policy Engine & Zero-Trust State Machine (`app/policy/`)
Enforces organizational security policy deterministically.

- **Mitigation-Aware Action Invariant:**
  An elevated synthetic speech score alone does **NOT** trigger an immediate `BLOCK` if mitigating signals exist (e.g., enrolled voice similarity $> 0.80$, low transaction exposure). Instead, the system invokes step-up verification (`REQUEST_VERIFICATION`) or restrictive holding (`RESTRICT`).
- **Dual Confirmation Anomaly Gate:**
  `BLOCK` is strictly reserved for:
  1. $R_{\text{composite}} \ge \text{block\_threshold}$ (default 80.0), OR
  2. Dual confirmed anomalies: High Deepfake ($> 0.70$) AND Speaker Mismatch ($> 0.60$), OR High Deepfake ($> 0.70$) AND High Conversational Threat ($> 0.60$).
- **Privileged / Executive Escalation:** High-risk or moderate-risk sessions targeting privileged accounts (e.g. CEO/CFO) trigger human security operations review (`HUMAN_REVIEW`).
- **Zero-Trust Finite State Machine:**
  $$\text{OBSERVING} \longrightarrow \text{CAUTION} \longrightarrow \text{VERIFYING} \longrightarrow \text{RESTRICTED} \longleftrightarrow \text{BLOCKED} / \text{TRUSTED}$$
  Unauthorized direct transitions to `TRUSTED` are strictly rejected by `ZeroTrustStateMachine`.
