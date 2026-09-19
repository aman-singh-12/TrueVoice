# TrueVoice Benchmark & Robustness Summary Report

**Generated:** 2026-09-18T10:19:54.661350+00:00  
**Environment Device:** CPU  
**Total Evaluations Run:** 8

## 1. Cross-Condition Performance Matrix

| Model | Dataset | Condition | Generator | Codec / Noise | Samples | Accuracy | F1 Score | ROC-AUC | EER (%) | Latency P50 | Latency P95 |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **mock-wav2vec2** | calibrated_reference | `clean` | synthetic_speech_simulation | None | 8 | 1.0 | 1.0 | 1.0 | 0.0 | 0.46ms | 2.92ms |
| **mock-wav2vec2** | calibrated_reference | `noise_awgn_10db` | synthetic_speech_simulation | AWGN | 8 | 0.5 | 0.6667 | 1.0 | 0.0 | 1.43ms | 2.14ms |
| **mock-wav2vec2** | calibrated_reference | `telephony_bandpass_300_3400hz` | synthetic_speech_simulation | Bandpass 300-3400Hz | 8 | 0.5 | 0.0 | 1.0 | 0.0 | 1.27ms | 5.4ms |
| **mock-wav2vec2** | calibrated_reference | `codec_g711_mulaw` | synthetic_speech_simulation | G.711 | 8 | 1.0 | 1.0 | 1.0 | 0.0 | 1.45ms | 1.95ms |
| **mock-wav2vec2** | calibrated_reference | `clipping_saturated` | synthetic_speech_simulation | None | 8 | 1.0 | 1.0 | 1.0 | 0.0 | 0.39ms | 0.67ms |
| **mock-wav2vec2** | calibrated_reference | `short_audio_0_5s` | synthetic_speech_simulation | None | 8 | 1.0 | 1.0 | 1.0 | 0.0 | 0.11ms | 0.16ms |
| **mock-wav2vec2** | wavefake | `clean` | unseen_neural_vocoders | None | 0 | NOT EVALUATED (Local dataset files not found) | NOT EVALUATED | NOT EVALUATED | NOT EVALUATED | N/Ams | N/Ams |
| **mock-wav2vec2** | asvspoof2019_la | `clean` | asvspoof_attacks | None | 0 | NOT EVALUATED (Local dataset files not found) | NOT EVALUATED | NOT EVALUATED | NOT EVALUATED | N/Ams | N/Ams |

## 2. Integrity & Evaluation Notes
- **Zero Fabrication**: If a dataset (e.g. WaveFake full corpus) is not installed locally, metrics explicitly state `NOT EVALUATED`.
- **Latency Standard**: Target latency is $P95 \le 80\text{ms}$ on GPU, $P95 \le 120\text{ms}$ on CPU for a canonical analysis window.
- **Model Interface**: All tests executed strictly through the public `DeepfakeDetector.predict()` interface without altering production weights.
