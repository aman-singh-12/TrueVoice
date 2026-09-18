# Third-Party Research Attribution & Benchmark Licenses

TrueVoice incorporates benchmark protocols, dataset loaders, and acoustic degradation methodologies inspired by leading open-source research projects. In compliance with open-source licensing standards, formal attribution is documented below.

---

## 1. audio-df-ucb / ClonedVoiceDetection

- **Authors / Organization**: UC Berkeley (audio-df-ucb)
- **Repository**: [https://github.com/audio-df-ucb/ClonedVoiceDetection](https://github.com/audio-df-ucb/ClonedVoiceDetection)
- **License**: BSD 3-Clause License
- **TrueVoice Adaptation**:
  - Codec simulation routines: G.711 $\mu$-law and A-law companding, 8-bit quantization.
  - Telephony channel degradation: PSTN bandpass filtering ($300\text{ Hz} \le f \le 3400\text{ Hz}$) and $8\text{ kHz}$ narrowband downsampling/upsampling.
  - VoIP packet loss simulation and jitter simulation in `benchmarks/augmentations/codec_simulator.py`.
- **License Notice**:
  ```
  Copyright (c) 2021, The Regents of the University of California
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:
  1. Redistributions of source code must retain the above copyright notice, this
     list of conditions and the following disclaimer.
  2. Redistributions in binary form must reproduce the above copyright notice,
     this list of conditions and the following disclaimer in the documentation
     and/or other materials provided with the distribution.
  3. Neither the name of the University of California, Berkeley nor the names of
     its contributors may be used to endorse or promote products derived from
     this software without specific prior written permission.
  ```

---

## 2. RUB-SysSec / WaveFake

- **Authors / Organization**: Joel Frank, Thorsten Holz — Ruhr University Bochum (Chair for System Security)
- **Paper**: *"WaveFake: A Data Set to Facilitate Audio Deepfake Detection"* (ACM MM 2021)
- **Repository**: [https://github.com/RUB-SysSec/wavefake](https://github.com/RUB-SysSec/wavefake)
- **License**: 
  - Code: MIT License / BSD
  - Dataset: Creative Commons Attribution 4.0 International (CC BY 4.0)
- **TrueVoice Adaptation**:
  - Out-of-distribution neural vocoder evaluation protocol across six vocoder architectures: MelGAN, Parallel WaveGAN, Multi-Band MelGAN, HiFi-GAN, WaveGlow, and FullSubNet.
  - Dataset adapter and loader in `benchmarks/datasets/wavefake/loader.py`.
  - TrueVoice strictly complies with CC BY 4.0 and does not redistribute the raw 30GB dataset within the repository.

---

## 3. ASVspoof Consortium (ASVspoof 2019 / 2021)

- **Authors**: ASVspoof Consortium
- **Website**: [https://www.asvspoof.org/](https://www.asvspoof.org/)
- **TrueVoice Adaptation**:
  - Standard Logical Access (LA) and Physical Access (PA) trial evaluation protocols.
  - Metric standards: Equal Error Rate (EER), False Acceptance Rate (FAR), and False Rejection Rate (FRR).
