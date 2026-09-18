# Repository Analysis 05: audio-df-ucb / ClonedVoiceDetection

## 1. Executive Summary & Purpose
- **Repository**: `audio-df-ucb/ClonedVoiceDetection`
- **Primary Domain**: Robust voice clone and deepfake audio detection under realistic channel degradation and acoustic laundering.
- **Purpose**: Academic research repository from UC Berkeley exploring how synthetic speech detectors perform under lossy compression, acoustic laundering, codec transcoding, noise corruption, and unseen synthetic generators.
- **Architectural Fit**: Maps directly to TrueVoice **Benchmarking & Robustness Evaluation**: providing realistic codec simulation, audio laundering perturbation pipelines, and data augmentation routines to validate TrueVoice under telephony and VoIP conditions.

---

## 2. Relevant Capability
- **Codec & Channel Laundering Simulation**:
  - Telephony codec transforms: G.711 ($\mu$-law / A-law), AMR-NB ($8\text{ kHz}$), AMR-WB ($16\text{ kHz}$), Opus ($6\text{–}64\text{ kbps}$), MP3, and AAC transcoding.
  - Acoustic room reverberation and additive noise injection.
  - Multi-stage transcoding (e.g., WhatsApp / Telegram / Zoom compression laundering).
- **Perceptual Feature Analysis**: Cross-evaluates classifiers across representations (learned raw features, STFT spectrograms, MFCCs, and self-supervised embeddings) to isolate vulnerability to compression artifacts.

---

## 3. Potential TrueVoice Components
| TrueVoice Module | Extracted / Referenced Capability | Architectural Role |
| :--- | :--- | :--- |
| `benchmarks.codec_augmenter` | `CodecSimulationPipeline` | Stress-testing models against telephony and VoIP compression |
| `core.audio.transforms` | Robustness data augmentations | Training/evaluation transforms for telephony robustness |

---

## 4. Reusable Code & Implementations
- **Acoustic Perturbation Pipeline**:
  - Python wrapper utilizing `torchaudio.sox_effects` and FFmpeg subprocess pipelines to simulate:
    - Bandpass filtering ($300\text{ Hz} \le f \le 3400\text{ Hz}$ standard PSTN telephone channel).
    - Bitrate downsampling and quantization ($8\text{-bit}$ companded $\mu$-law).
    - Packet loss concealment (burst dropout) and jitter buffer artifacts.
- **Evaluation Harness**: Scripts calculating cross-codec Equal Error Rate (EER) and Area Under the ROC Curve (AUC) across degraded audio sets.

---

## 5. Reusable Model Checkpoints
- **Model Checkpoints**: Contains baseline classification models trained across multiple codecs.
- **Role in TrueVoice**: Models are research artifacts; TrueVoice will not use these weights directly in production, but will use their published degradation benchmarks to validate TrueVoice's robustness targets.

---

## 6. Datasets Used
- In-the-Wild deepfake speech samples, ASVspoof 2019/2021 LA subsets, and custom synthesized voices transcoded across varied bitrates.

---

## 7. License & Compliance Audit
- **License**: BSD 3-Clause / Academic Open Source.
- **Modification Allowed**: Yes.
- **Commercial / Competition Use Allowed**: Yes, subject to standard BSD 3-clause attribution.
- **Patent / Restriction Clauses**: None.
- **Redistribution Stance**: Fully compatible with TrueVoice's repository and benchmark harness.

---

## 8. Dependencies & Environment
- `torch >= 1.10.0`
- `torchaudio >= 0.10.0`
- `ffmpeg` system binary (for codec transcoding: AMR, Opus, MP3, AAC)
- `scipy >= 1.7.0`
- `numpy >= 1.20.0`

---

## 9. Risks & Limitations
1. **FFmpeg Subprocess Overhead**: Spawning external FFmpeg processes for live audio transcoding is prohibitively slow for real-time inference ($>50\text{ ms}$ per chunk). Must be used strictly for offline benchmarking or offline dataset augmentation.
2. **Audio Bandwidth Mismatch**: PSTN telephony audio ($8\text{ kHz}$) lacks high-frequency harmonics ($>4\text{ kHz}$); feeding $8\text{ kHz}$ audio zero-padded or resampled into $16\text{ kHz}$ models can cause false positive synthetic alarms if the model relies heavily on high-frequency cutoff artifacts.

---

## 10. Architectural Recommendation for TrueVoice
- **Extract & Adapt**:
  - Integrate the **codec simulation pipeline** into TrueVoice's offline benchmark suite (`benchmarks/benchmark_plan.md` category: *Telephony & Compressed Audio*).
  - Use these transforms to verify that TrueVoice's models do not experience catastrophic EER degradation when audio is transmitted via Zoom, Google Meet, or cellular telephony.
  - Incorporate the $8\text{ kHz} \to 16\text{ kHz}$ bandpass detection logic into the TrueVoice audio preprocessor: if incoming audio is identified as narrowband telephony ($8\text{ kHz}$), adjust the DSP spectral slope and HNR thresholds to avoid false positives.
