# TrueVoice — Quick Viva Revision Cheatsheet

**Purpose:** 5-minute rapid memory refresher immediately prior to entering the viva or technical defense panel.  
**Repository Branch:** `integration/truevoice-final`  
**Test Suite:** 109 passed, 2 skipped (100% pass rate in mock CI mode)

---

## 1. 30-SECOND ELEVATOR PITCH
> "TrueVoice is an AI-powered real-time voice security platform that detects voice cloning and social engineering in live interactions. Rather than relying on a single deepfake detector, it runs a two-branch concurrent pipeline fusing 5 independent signals: neural deepfake detection, ECAPA-TDNN speaker biometrics, deterministic DSP acoustics, Whisper ASR intent intelligence, and transactional context. An asymmetric EMA smoothing filter prevents score jitter, while a Zero-Trust Policy Decision Point enforces security actions backed by a tamper-evident SHA-256 hash-chained audit ledger."

---

## 2. THE CANONICAL NUMBERS TO MEMORIZE

| Parameter | Exact Value | Where Defined | Why This Value? |
| :--- | :--- | :--- | :--- |
| **Sample Rate** | `16,000 Hz` (16 kHz) | `app/config.py` | Native training rate for Wav2Vec2, Whisper, ECAPA-TDNN; 8 kHz Nyquist covers voice formants. |
| **Bit Depth / Format** | `PCM16 LE` (16-bit) | `app/audio/decoder.py` | Standard telephony linear PCM integer representation (2 bytes per sample). |
| **Channels** | `1` (Mono) | `app/config.py` | Single-channel voice interaction analysis. |
| **Analysis Window** | `2.0 seconds` (`32,000` samples) | `app/config.py` | Sufficient phonemic context for self-attention without excessive initial latency. |
| **Hop Size** | `0.5 seconds` (`8,000` samples) | `app/config.py` | Rolling update frequency ($2\text{ Hz}$) for responsive live dashboard telemetry. |
| **Buffer Capacity** | `10.0 seconds` (`160,000` samples) | `app/audio/buffer.py` | Fixed circular NumPy array; $O(1)$ memory allocation; zero GC pauses. |
| **WS Frame Limit** | `65,536 bytes` (64 KB) | `app/api/websocket/audio_stream.py` | Rejects oversized frames with WS close code `1009` (DoS protection). |
| **WS Ticket Lifetime**| `5 minutes` (300 seconds) | `app/core/security.py` | Short-lived single-use ticket prevents credential leakage in query strings. |
| **OOB Challenge TTL**| `30 seconds` | `app/config.py` | Fast expiration prevents replay attacks against 6-digit secondary OTPs. |
| **Base Risk Weights** | $0.35, 0.25, 0.15, 0.15, 0.10$ | `app/config.py` | Deepfake (0.35), Speaker (0.25), Context (0.15), Intent (0.15), Forensic (0.10). |
| **Compounding ($\Gamma$)**| `1.35` multiplier | `app/config.py` | Escalates raw risk when synthetic voice $\ge 70\%$ is corroborated by mismatch/threat. |
| **EMA Smoothing** | $\alpha_{\text{attack}}=0.60, \alpha_{\text{decay}}=0.20$ | `app/config.py` | Fast attack escalation ($0.60$), cautious threat de-escalation ($0.20$). |
| **Risk Tiers** | `30.0, 60.0, 80.0` | `app/core/constants.py` | $0\text{--}29$: LOW, $30\text{--}59$: MODERATE, $60\text{--}79$: HIGH, $80\text{--}100$: CRITICAL. |
| **Speaker Threshold** | `0.75` | `app/config.py` | Operating threshold on normalized geometric similarity ($0.0\text{--}1.0$). |
| **VAD Threshold** | `-45.0 dBFS` | `app/audio/vad.py` | Energy noise floor below which frames are flagged as non-speech silence. |

---

## 3. CORE ARCHITECTURAL INVARIANTS (MUST DEFEND IN VIVA)

### Invariant 1: High Deepfake ALONE $\neq$ Instant Block
* **Rule:** If deepfake is 90% but speaker voiceprint matches ($>0.75$) and context is low, TrueVoice does **NOT** instantly drop the call (`BLOCK`). It issues `REQUEST_VERIFICATION` or `WARN`.
* **Reason:** Real-world cellular/Bluetooth audio induces acoustic distortions that trigger false-positive deepfake spikes. Irreversible blocks require corroborating evidence (biometric mismatch OR threat keywords OR high-value transaction).

### Invariant 2: Risk $\neq$ Policy
* **Risk Engine:** Mathematical observer calculating exposure in $[0.0, 100.0]$.
* **Policy Engine:** Declarative decision maker evaluating tenant rules to dispatch security actions (`ALLOW`, `WARN`, `REQUEST_VERIFICATION`, `RESTRICT`, `BLOCK`, `HUMAN_REVIEW`).

### Invariant 3: Missing Evidence $\neq$ Safe or Malicious
* When a component is missing (e.g. no speaker enrolled), TrueVoice uses **Dynamic Weight Renormalization** ($\hat{w}_i = w_i / \sum_{\mathcal{A}} w$). It recalculates weights so active signals sum to 1.0 without assuming missing data is 0 or 1.

### Invariant 4: Zero Raw Audio Persistence
* Audio chunks live purely in transient circular RAM buffers. Neither database tables nor application logs ever persist raw audio waveforms, guaranteeing biometric privacy and GDPR/DPDP compliance.

---

## 4. MODEL CHEATSHEET (WHAT, WHY, HOW)

### Wav2Vec 2.0 (Deepfake Detection)
* **What:** Fine-tuned speech Transformer sequence classifier.
* **Why:** Self-attention heads detect subtle vocoder phase mismatches and unnatural phoneme transition artifacts across time.
* **Input/Output:** 16kHz float32 audio (RMS normalized to -24 dBFS) $\rightarrow$ Synthetic probability score $[0.0, 100.0]$.
* **Viva Note:** Must emphasize that TrueVoice requires an explicitly fine-tuned deepfake checkpoint; an off-the-shelf base model does not output deepfake scores.

### RawNet2 (Deepfake Detection)
* **What:** End-to-end raw time-domain anti-spoofing model.
* **Why:** Operates directly on raw waveforms without STFT, preserving phase information and high-frequency harmonics.
* **How:** SincNet mel-scale bandpass filterbank $\rightarrow$ F-SE residual blocks $\rightarrow$ Bidirectional GRU $\rightarrow$ Linear head.
* **Input/Output:** 16kHz raw waveform with pre-emphasis ($\alpha=0.97$) $\rightarrow$ Spoof probability $[0.0, 100.0]$.

### AASIST (Deepfake Detection)
* **What:** Integrated Spectro-Temporal Graph Attention Network.
* **Why:** Models speech as a heterogeneous graph, correlating spectral sub-band anomalies with disparate temporal time frames.
* **How:** SincNet frontend $\rightarrow$ Spectro-temporal ResBlocks $\rightarrow$ Heterogeneous GAT $\rightarrow$ Readout.
* **Input/Output:** 16kHz raw waveform $\rightarrow$ Spoof posterior probability $[0.0, 100.0]$.

### ECAPA-TDNN (Speaker Biometrics)
* **What:** 192-dimensional speaker verification neural network (SpeechBrain).
* **Why:** 1:1 biometric identity confirmation against an enrolled voiceprint centroid.
* **How:** 1D dilated convolutions (TDNN) $\rightarrow$ Squeeze-and-Excitation channel attention $\rightarrow$ 192-d unit embedding $\rightarrow$ Cosine similarity.
* **Similarity Formula:** $\text{Similarity} = (\text{Cosine Sim} + 1.0) / 2.0 \in [0.0, 1.0]$.
* **Viva Note:** The 0.75 threshold is a configurable operating point, not a universal mathematical constant.

### Faster-Whisper (Speech-to-Text)
* **What:** CTranslate2-accelerated quantized INT8/FP16 Whisper Transformer.
* **Why:** Real-time factor $<0.15\times$ transcription for social engineering detection.
* **Input/Output:** 16kHz audio $\rightarrow$ Spoken text string and detected language code.

### DSP Forensics (12 Physical Metrics)
* **What:** Deterministic acoustic measurements: Pitch ($F_0$), Max Pitch Jump, Local Jitter, Shimmer, HNR, Spectral Centroid, Rolloff, Flatness, Flux, RMS, ZCR, Energy Distribution.
* **Why:** Provides explainable physical acoustic evidence independent of black-box neural networks.
* **Viva Note:** DSP anomalies represent acoustic distortion/smoothing, NOT standalone proof of a deepfake.

---

## 5. MATHEMATICAL FORMULAS QUICK REFERENCE

### 1. Dynamic Weight Renormalization
$$\hat{w}_i = \frac{w_i}{\sum_{j \in \mathcal{A}} w_j}, \quad \sum_{i \in \mathcal{A}} \hat{w}_i = 1.0$$

### 2. Linear Risk Fusion
$$R_{\text{linear}} = 100.0 \times \sum_{i \in \mathcal{A}} \hat{w}_i \cdot s_i, \quad s_i \in [0.0, 1.0]$$

### 3. Non-Linear Compounding
$$\text{If } S_{\text{df}} \ge 70.0 \text{ and } (S_{\text{spk}} \le 0.50 \text{ or } S_{\text{conv}} \ge 0.70 \text{ or } S_{\text{ctx}} \ge 0.70):$$
$$R_{\text{raw}} = \min(100.0, R_{\text{linear}} \times 1.35)$$

### 4. Asymmetric EMA Smoothing
$$S_t = \alpha R_t + (1 - \alpha) S_{t-1}, \quad \alpha = \begin{cases} 0.60, & R_t > S_{t-1} \text{ (Attack)} \\ 0.20, & R_t \le S_{t-1} \text{ (Decay)} \end{cases}$$

### 5. Cryptographic SHA-256 Audit Chain
$$H_n = \text{SHA-256}\left(H_{n-1} \;\|\; \text{CanonicalJSON}(\text{Event}_n)\right), \quad H_0 = \text{"0"}\times 64$$

---

## 6. TOP 5 TRICK QUESTIONS & BULLETPROOF VIVA ANSWERS

1. **"Is your risk score a probability of deepfake?"**  
   *Answer:* "No. It is a multi-signal normalized security exposure score from 0 to 100. A score of 80 means high operational risk requiring defensive action, not that there is an 80% statistical chance of fraud."

2. **"What happens if an attacker speaks and then goes completely silent?"**  
   *Answer:* "VAD detects silence and suppresses new inferences. The asymmetric EMA decay alpha of 0.20 ensures the previous elevated risk score decays very slowly, preventing attackers from wiping their risk score by pausing."

3. **"Can an operator with database admin rights alter the audit history?"**  
   *Answer:* "They could update a row in PostgreSQL, but because each event stores a SHA-256 hash linking to its parent ($H_n = \text{SHA256}(H_{n-1} \| \dots)$), modifying any past row breaks the hash chain of all subsequent events. The verification tool immediately flags the exact sequence ID that was tampered with."

4. **"Why don't you use blockchain for the audit log?"**  
   *Answer:* "A decentralized blockchain introduces multi-second block confirmation times and high transaction fees incompatible with sub-second streaming audio. Our internal SHA-256 hash chain provides mathematical tamper-evidence with microsecond execution times."

5. **"How does the system differentiate a genuine call in a noisy street from a deepfake?"**  
   *Answer:* "Street noise may cause a DSP acoustic anomaly, but the speaker verification model will confirm the voiceprint matches, and the Intent Analyzer will see zero threat phrases. Because of our multi-signal fusion and dual confirmation rule, street noise alone will never trigger a BLOCK."
