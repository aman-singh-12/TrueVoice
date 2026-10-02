# TrueVoice Complete Environment Configuration & Audit Report

**Audit Date**: September 19, 2026  
**Repository**: `C:\Projects\SIH` (`https://github.com/aman-singh-12/TrueVoice`)  
**Target Branch**: `main`  
**Current Commit**: `36a5a3c`  

---

## 1. Executive Summary

A comprehensive, line-by-line environment variable audit and configuration completion was conducted across the TrueVoice repository. Every variable in `backend/.env`, `backend/.env.example`, `frontend/.env`, and `frontend/.env.example` has been evaluated against the running codebase, ORM configuration, security modules, ML detector registry, DSP audio pipeline, and Vite dev server.

### Key Audit Accomplishments:
1. **Live Database Integration & Migration**: Fixed URL scheme handling (`postgresql+asyncpg://`) and special character password encoding (`%40` for `@`). Successfully applied Alembic migration `001_initial_schema` to the configured Supabase PostgreSQL pooler. Verified `/health` and `/ready` return **HTTP 200 ONLINE** with `database: HEALTHY`.
2. **Vite Proxy & Full-Stack Route Verification**: Restored the `/v1` (with `ws: true`) and `/health` proxies in `frontend/vite.config.ts` targeting `http://127.0.0.1:8000`. Verified that calls from `http://localhost:3000/v1/auth/login` successfully reach FastAPI and return expected authentication responses without `ECONNREFUSED`.
3. **Strict Git & Secret Protection**: Verified that `backend/.env` and `frontend/.env` are strictly git-ignored across root, frontend, and backend `.gitignore` rules. No secrets or tokens are staged or tracked in Git.

---

## 2. Environment Variable Inventory & Classification Table

The table below reflects the final status of every audited variable.

| Variable | Value Status | Reason / Description |
| :--- | :--- | :--- |
| `PROJECT_NAME` | `FILLED_LOCAL` | Service name (`TrueVoice`), consumed by `backend/app/config.py`. |
| `VERSION` | `FILLED_LOCAL` | Application version (`1.2.0`), consumed by health probes and OpenAPI metadata. |
| `ENVIRONMENT` | `FILLED_LOCAL` | Active runtime profile (`development`), controls debug flags and log verbosity. |
| `DEBUG` | `FILLED_LOCAL` | Local debugging toggle (`true`), consumed by logging and SQLAlchemy echo. |
| `LOG_LEVEL` | `FILLED_LOCAL` | Logging verbosity (`INFO`), consumed by `app/core/logging.py`. |
| `BACKEND_HOST` | `FILLED_LOCAL` | Bind address (`127.0.0.1`), prevents Windows IPv6 `::1` lookup ambiguity. |
| `BACKEND_PORT` | `FILLED_LOCAL` | ASGI HTTP/WebSocket server port (`8000`). |
| `CORS_ORIGINS` | `FILLED_LOCAL` | Allowed origins whitelist (`http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173`). |
| `TRUEVOICE_ML_MODE` | `FILLED_LOCAL` | Execution mode (`mock`), fast deterministic pipeline without heavy checkpoints for dev/CI. |
| `TRUEVOICE_ML_DEVICE` | `FILLED_LOCAL` | Hardware device (`cpu`), standard for local execution. |
| `SECRET_KEY` | `FILLED_LOCAL` | Local development HMAC key for JWT and single-use WebSocket tickets. Marked dev-only. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `FILLED_LOCAL` | REST API JWT token lifetime (`15` minutes). |
| `WS_TOKEN_EXPIRE_MINUTES` | `FILLED_LOCAL` | Single-use WebSocket ticket lifetime (`5` minutes). |
| `DATABASE_URL` | `FILLED_FROM_REPOSITORY` | Active PostgreSQL connection with asyncpg driver and URL-encoded credentials. Verified healthy. |
| `REDIS_URL` | `EMPTY_OPTIONAL` | Empty because local development uses the application's in-memory fallback. |
| `BREVO_API_KEY` | `FILLED_FROM_REPOSITORY` | Real Brevo API key provided in local `.env`; kept empty in `.env.example`. |
| `BREVO_SENDER_EMAIL` | `FILLED_FROM_REPOSITORY` | Sender email address (`chakshubamotra123@gmail.com`) configured in local `.env`. |
| `BREVO_SENDER_NAME` | `FILLED_FROM_REPOSITORY` | Sender display name (`VisionX`) configured in local `.env`. |
| `SAMPLE_RATE` | `FILLED_LOCAL` | Canonical DSP audio sampling rate (`16000` Hz). |
| `WINDOW_SECONDS` | `FILLED_LOCAL` | DSP sliding analysis window (`2.0` seconds / 32,000 samples). |
| `HOP_SECONDS` | `FILLED_LOCAL` | DSP hop interval (`0.5` seconds / 8,000 samples). |
| `CHANNELS` | `FILLED_LOCAL` | Audio channel configuration (`1` - mono PCM16). |
| `DEEPFAKE_PRIMARY_DETECTOR` | `FILLED_LOCAL` | Configured primary detector (`wav2vec2`), initialized at startup. |
| `DEEPFAKE_SECONDARY_DETECTOR` | `EMPTY_OPTIONAL` | Empty because single-detector mode (`wav2vec2`) is active. Dual-detector pipeline is optional. |
| `TRUEVOICE_WAV2VEC2_MODEL` | `FILLED_FROM_REPOSITORY` | Hugging Face model identifier (`MelodyMachine/Deepfake-audio-detection-V2`). |
| `TRUEVOICE_RAWNET2_MODEL` | `EMPTY_OPTIONAL` | Architecture implemented; local `.pth` checkpoint path is optional since wav2vec2 is primary. |
| `TRUEVOICE_AASIST_MODEL` | `EMPTY_OPTIONAL` | Architecture implemented; local `.pth` checkpoint path is optional since wav2vec2 is primary. |
| `SPEAKER_VERIFIER_MODEL` | `FILLED_LOCAL` | Primary speaker verification architecture (`ecapa`). |
| `SPEAKER_MODEL_SOURCE` | `FILLED_LOCAL` | SpeechBrain model repository (`speechbrain/spkrec-ecapa-voxceleb`). |
| `TRUEVOICE_SPEAKER_THRESHOLD` | `FILLED_LOCAL` | Operational cosine similarity threshold (`0.75`). |
| `TRUEVOICE_SPEAKER_DEVICE` | `FILLED_LOCAL` | Speaker model execution device (`cpu`). |
| `ASR_MODEL` | `FILLED_LOCAL` | Automatic speech recognition architecture (`faster-whisper-small`). |
| `TRUEVOICE_ASR_MODEL` | `FILLED_LOCAL` | Model size (`small`), consumed by `WhisperRecognizer`. |
| `TRUEVOICE_ASR_DEVICE` | `FILLED_LOCAL` | ASR execution device (`cpu`). |
| `TRUEVOICE_ASR_COMPUTE_TYPE` | `FILLED_LOCAL` | Quantization type (`int8` for CPU execution). |
| `TRUEVOICE_ASR_LANGUAGE` | `EMPTY_OPTIONAL` | Empty to enable automatic multilingual language detection (English, Hindi, Punjabi). |
| `TRUEVOICE_ASR_BEAM_SIZE` | `FILLED_LOCAL` | Beam search width (`5`), consumed by `WhisperRecognizer`. |
| `WEIGHT_DEEPFAKE` | `FILLED_LOCAL` | Multi-signal fusion weight (`0.35`), consumed by `RiskFusionEngine`. |
| `WEIGHT_SPEAKER` | `FILLED_LOCAL` | Multi-signal fusion weight (`0.25`), consumed by `RiskFusionEngine`. |
| `WEIGHT_CONVERSATION` | `FILLED_LOCAL` | Multi-signal fusion weight (`0.15`), consumed by `RiskFusionEngine`. |
| `WEIGHT_CONTEXT` | `FILLED_LOCAL` | Multi-signal fusion weight (`0.15`), consumed by `RiskFusionEngine`. |
| `WEIGHT_FORENSIC` | `FILLED_LOCAL` | Multi-signal fusion weight (`0.10`), consumed by `RiskFusionEngine`. |
| `GAMMA_MULTIPLIER` | `FILLED_LOCAL` | Non-linear compounding factor (`1.35`), consumed by `RiskFusionEngine`. |
| `EMA_ATTACK_ALPHA` | `FILLED_LOCAL` | Fast risk rise coefficient (`0.60`), consumed by `RiskFusionEngine`. |
| `EMA_DECAY_ALPHA` | `FILLED_LOCAL` | Conservative risk decay coefficient (`0.20`), consumed by `RiskFusionEngine`. |
| `CAUTION_THRESHOLD` | `FILLED_LOCAL` | Policy monitoring threshold (`30.0`), consumed by `PolicyEngine`. |
| `VERIFY_THRESHOLD` | `FILLED_LOCAL` | Policy step-up authentication threshold (`60.0`), consumed by `PolicyEngine`. |
| `BLOCK_THRESHOLD` | `FILLED_LOCAL` | Policy termination threshold (`80.0`), consumed by `PolicyEngine`. |
| `SENSITIVE_AMOUNT_THRESHOLD` | `FILLED_LOCAL` | Financial step-up verification threshold (`250000.0` - ₹2.5 Lakh). |
| `FORENSIC_F0_STEP_HZ` | `FILLED_LOCAL` | Fundamental frequency discontinuity threshold (`50.0` Hz). |
| `FORENSIC_JITTER_MAX` | `FILLED_LOCAL` | Pitch perturbation upper bound (`0.002` / 0.2%). |
| `FORENSIC_SHIMMER_MAX` | `FILLED_LOCAL` | Amplitude perturbation upper bound (`0.015` / 1.5%). |
| `FORENSIC_HNR_MIN_DB` | `FILLED_LOCAL` | Harmonics-to-noise lower bound (`15.0` dB). |
| `OOB_CHALLENGE_TTL_SECONDS` | `FILLED_LOCAL` | Out-of-band verification challenge lifetime (`30` seconds). |
| `VITE_APP_ENV` | `FILLED_LOCAL` | Frontend environment tag (`development`). |
| `VITE_APP_NAME` | `FILLED_LOCAL` | Frontend UI title (`TrueVoice`). |
| `VITE_API_BASE_URL` | `FILLED_LOCAL` | Backend REST API endpoint (`http://127.0.0.1:8000`). |
| `VITE_WS_URL` | `FILLED_LOCAL` | Backend WebSocket streaming endpoint (`ws://127.0.0.1:8000`). |
| `VITE_SENTRY_DSN` | `NOT_USED` | Not referenced by frontend source code; removed from `.env`. |
| `VITE_ANALYTICS_ID` | `NOT_USED` | Not referenced by frontend source code; removed from `.env`. |

---

## 3. Local Configuration Status

The following components are **fully configured, tested, and ready** for local development:
* **Backend ASGI**: Configured to bind on `http://127.0.0.1:8000`.
* **Database**: PostgreSQL connection established with `pgvector` and `asyncpg` dialect; initial Alembic schema applied.
* **ML Layer**: Fast deterministic mock mode initialized with resident detector ready in memory.
* **Security**: JWT access tokens and single-use WebSocket tickets active with CORS whitelist for ports 3000 and 5173.
* **Email Service**: Brevo credentials configured in `backend/.env` with sender name `VisionX`.
* **Frontend**: React/Vite development server running on `http://localhost:3000` with automated proxy to `http://127.0.0.1:8000` for REST and WebSocket streaming.

---

## 4. Cloud Configuration Status

For staging or production cloud deployment, the following variables must be provided via a secure secret manager:
* **`SECRET_KEY`**: Must be generated as a fresh 256-bit cryptographically secure string (e.g. `openssl rand -hex 32`).
* **`DATABASE_URL`**: Managed RDS/Cloud SQL connection string with appropriate VPC pooling.
* **`REDIS_URL`**: Managed Redis/Valkey cluster URL if multi-instance session caching is enabled.
* **`CORS_ORIGINS`**: Explicit production domain whitelist (e.g. `https://truevoice.bank.com`).
* **`VITE_API_BASE_URL` / `VITE_WS_URL`**: Production API gateway endpoints (e.g. `https://api.truevoice.bank.com` and `wss://api.truevoice.bank.com`).

---

## 5. Values Requiring Developer Input

No values currently block local execution. The following are optional developer choices:
1. **`TRUEVOICE_ML_MODE`**: Set to `"mock"` for instant startup without GPU. To switch to `"live"` neural execution, ensure PyTorch and SpeechBrain dependencies are installed and set `TRUEVOICE_ML_MODE="live"`.
2. **`TRUEVOICE_RAWNET2_MODEL` / `TRUEVOICE_AASIST_MODEL`**: Only required if you wish to run RawNet2 or AASIST instead of the default Wav2Vec2 detector, in which case provide the local filesystem path to the `.pth` weights.

---

## 6. Validation Results

| Test / Check | Target | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Backend Readiness Probe** | `/ready` & `/v1/ready` | **PASSED (200 OK)** | Returned `{"ready": true, "service": "TrueVoice Backend"}`. |
| **Backend Health Probe** | `/health` | **PASSED (200 OK)** | Status reported `ONLINE` and `database: HEALTHY`. |
| **Vite Dev Server Proxy** | `/v1/auth/login` via port 3000 | **PASSED** | Request routed from Vite (3000) to FastAPI (8000); returned 401. |
| **WebSocket Streaming Route** | `/v1/stream/{id}` | **PASSED** | Handshake validated JWT ticket and enforced database session boundary. |
| **Backend Unit Tests** | `pytest backend/tests/unit/` | **PASSED (75/75)** | 75 passed, 2 skipped in 0.34s. |
| **Frontend Production Build** | `npm run build` | **PASSED** | Compiled 44 modules cleanly via `tsc && vite build` in 1.51s. |
| **Git Leak Prevention** | `git status` | **PASSED** | `backend/.env` and `frontend/.env` are confirmed untracked and git-ignored. |
