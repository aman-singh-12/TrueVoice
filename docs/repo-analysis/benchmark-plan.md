# TrueVoice Offline Benchmark & Evaluation Plan

## 1. Executive Purpose
The TrueVoice Offline Benchmark Suite evaluates candidate deepfake detection and speaker verification components under a standardized, reproducible evaluation harness before final production deployment. 

TrueVoice does not guess which model is best; it benchmarks candidates across eight rigorous acoustic degradation categories, measuring accuracy, out-of-distribution generalization, inference latency, and hardware resource consumption.

---

## 2. Candidate Models Under Evaluation

| Candidate ID | Model Architecture | Source Reference | Branch Placement | Parameter Count | Target Execution Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **M1** | **Wav2Vec 2.0 (Base / Fine-tuned)** | `Tejahudson/voice-cloning-detector` | Branch 1 | $\approx 95\text{ M}$ | GPU Primary / CPU Quantized |
| **M2** | **RawNet2 (Canonical)** | `NTU-ROSE/RawNet2` | Branch 1 | $\approx 1.2\text{ M}$ | CPU / GPU Lightweight Mode |
| **M3** | **AASIST (Full)** | `clovaai/aasist` | Branch 1 | $\approx 297\text{ k}$ | High-Accuracy Evaluation |
| **M4** | **AASIST-L (Lightweight)** | `clovaai/aasist` | Branch 1 | $\approx 85\text{ k}$ | Edge / Low-Latency Mode |
| **M0** | **2D Mel-Spectrogram CNN (Baseline)** | `pk9444/2xqcTCqAYvy0SJbK` / `wavefake` | Baseline | $\approx 420\text{ k}$ | Comparative Ablation Only |
| **SV1** | **ECAPA-TDNN (192-d)** | `mpyt/Ecapa-TDNN` | Branch 2 | $\approx 6.2\text{ M}$ | Identity Verification Engine |

---

## 3. Evaluation Dataset Categories & Test Sets

To prevent benchmark overfitting and guarantee real-world resilience, TrueVoice evaluates models across **eight distinct acoustic categories**:

```
                                  EVALUATION CORPUS
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
  [Acoustic Domains]             [Channel Stress]              [Adversarial & Unseen]
  ├─ 1. Genuine Human Speech     ├─ 5. Compressed (VoIP)       ├─ 8. Unseen Neural Vocoders
  ├─ 2. Synthetic TTS            ├─ 6. Additive Noise & Reverb      (WaveFake: MelGAN, HiFi-GAN,
  ├─ 3. Voice Conversion (VC)    ├─ 7. Narrowband Telephony          WaveGlow, FullSubNet)
  └─ 4. Physical Acoustic Replay      (G.711, AMR, 8kHz)
```

### Dataset Category Details
1. **Category 1: Genuine Human Speech (Clean)**
   - *Data Sources*: LibriSpeech `test-clean`, ASVspoof 2019 LA bona fide, VoxCeleb1-O test.
   - *Purpose*: Measures False Rejection Rate (FRR) on uncorrupted natural human dialogue.
2. **Category 2: Synthetic Text-to-Speech (TTS)**
   - *Data Sources*: ASVspoof 2019 LA algorithms A01–A06 (Tacotron2, Transformer TTS).
   - *Purpose*: Evaluates detection of standard autoregressive neural TTS.
3. **Category 3: Voice Conversion (VC)**
   - *Data Sources*: ASVspoof 2019 LA algorithms A07–A19, VCC2020 evaluation sets.
   - *Purpose*: Evaluates detection of speaker identity replacement where linguistic prosody belongs to an authentic human speaker.
4. **Category 4: Physical Acoustic Replay**
   - *Data Sources*: ASVspoof 2019 Physical Access (PA) evaluation subsets.
   - *Purpose*: Evaluates detection of synthetic audio re-recorded through commodity loudspeakers and microphones.
5. **Category 5: Compressed & Transcoded VoIP Audio**
   - *Data Sources*: Opus ($12\text{ kbps}$, $24\text{ kbps}$, $64\text{ kbps}$), AAC ($32\text{ kbps}$), MP3 ($64\text{ kbps}$) transcoded using `audio-df-ucb/ClonedVoiceDetection` transforms.
   - *Purpose*: Simulates Zoom, Google Meet, Teams, and WhatsApp streaming compression.
6. **Category 6: Environmental Noise & Reverberation**
   - *Data Sources*: MUSAN corpus (babble, ambient office, cafe, street noise at $+10\text{ dB}$, $+5\text{ dB}$, $0\text{ dB}$ SNR) + RIR synthetic room impulse responses.
   - *Purpose*: Evaluates robustness against call center background babble.
7. **Category 7: Narrowband Telephony (PSTN / Cellular)**
   - *Data Sources*: G.711 $\mu$-law/A-law ($8\text{ kHz}$, $64\text{ kbps}$), AMR-NB ($8\text{ kHz}$, $12.2\text{ kbps}$), bandpass filtered ($300\text{–}3400\text{ Hz}$).
   - *Purpose*: Validates cellular telephone call fraud interception without high-frequency harmonics.
8. **Category 8: Unseen Neural Vocoders (Zero-Day Generalization)**
   - *Data Sources*: `RUB-SysSec/wavefake` test partitions (MelGAN, Parallel WaveGAN, Multi-Band MelGAN, HiFi-GAN, WaveGlow, FullSubNet).
   - *Purpose*: Evaluates generalization against synthesis engines completely omitted from model training.

---

## 4. Evaluation Metrics & Target Benchmarks

### Accuracy Metrics
- **Equal Error Rate (EER %)**: The operating point where False Acceptance Rate (FAR) equals False Rejection Rate (FRR). Target: $\text{EER} \le 3.5\%$ on clean TTS; $\le 7.0\%$ on unseen vocoders.
- **Area Under the ROC Curve (AUC-ROC)**: Overall discrimination capability across all potential threshold settings. Target: $\text{AUC} \ge 0.96$.
- **Minimum Tandem Detection Cost Function (min t-DCF)**: Standard biometric metric measuring cost of spoofing attacks in tandem with speaker verification. Target: $\le 0.08$.

### Performance & Systems Metrics
- **Inference Latency (p50 / p95 / p99)**: Time required to process a 1.0-second chunk (in milliseconds). Target: $p95 \le 80\text{ ms}$ on GPU; $p95 \le 120\text{ ms}$ on CPU.
- **Memory Footprint (RAM & VRAM)**: Peak resident set size (RSS) in system RAM and GPU VRAM during concurrent multi-stream execution. Target: $\le 1.8\text{ GB}$ VRAM per active detector worker.
- **Throughput**: Audio streaming chunks processed per second per core.

---

## 5. Experimental Protocol: Single-Chunk vs. Temporal Window Aggregation

To test the efficacy of the `ConfidenceWeightedAggregator` (adapted from `VoiceVault`), the benchmark evaluates all models under two distinct operating modes:

```
Mode A: Single-Chunk Evaluation
Incoming 1.0s Chunk ──────► Model Inference ──────► Direct Metric Calculation

Mode B: Temporal Aggregated Evaluation (TrueVoice Real-Time Pipeline)
Incoming 1.0s Chunks ─────► Rolling Ring Buffer ──► Confidence-Weighted EMA ──► Smoothed Metric
                            (3-Chunk Window)        (w_i based on |s_i - 0.5|)
```

### Empirical Hypothesis
- Mode B is expected to reduce False Positives by $\ge 40\%$ on transient noise bursts (coughing, microphone bump) compared to Mode A, stabilizing streaming risk scores.

---

## 6. Benchmark Implementation Architecture

```
docs/repo-analysis/
└── benchmark_harness/
    ├── __init__.py
    ├── runner.py                 # CLI benchmark runner orchestrating tests
    ├── config.yaml               # Dataset paths, thresholds, batch sizes
    ├── loaders/
    │   ├── asvspoof_loader.py    # ASVspoof 2019 LA & PA loader
    │   ├── wavefake_loader.py    # WaveFake multi-generator loader (Repo 06)
    │   └── codec_augmenter.py    # FFmpeg/Sox perturbation pipeline (Repo 05)
    ├── models/
    │   ├── base.py               # Abstract DeepfakeDetector interface
    │   ├── wav2vec2_wrapper.py   # M1: Wav2Vec2 detector (Repo 01)
    │   ├── rawnet2_wrapper.py    # M2: Canonical RawNet2 (Repo 04)
    │   ├── aasist_wrapper.py     # M3 & M4: AASIST & AASIST-L (Repo 03)
    │   └── cnn_wrapper.py        # M0: Mel-CNN baseline (Repo 08)
    └── metrics/
        ├── eer_calculator.py     # ROC, EER, and min t-DCF routines
        └── resource_monitor.py   # CPU, RAM, VRAM, and latency profiling
```

---

## 7. Execution Timeline & Decision Gate
1. **Phase 1: Clean Baseline Benchmark**: Run all candidates on Categories 1, 2, and 3. Establish baseline EER and latency rankings.
2. **Phase 2: Stress & Telephony Benchmark**: Apply Categories 5, 6, and 7 to evaluate degradation under compression and noise.
3. **Phase 3: Out-of-Distribution Generalization**: Run Category 8 (WaveFake). Discard any candidate model that experiences catastrophic EER collapse ($>25\%$).
4. **Phase 4: Component Selection Gate**: Select final model configuration for TrueVoice Branch 1 based on Pareto optimality between EER and latency ($p95 \le 120\text{ ms}$).
