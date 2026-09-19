# TrueVoice Environment Configuration Guide

## 1. Overview

TrueVoice employs a two-tier configuration architecture:
1. **Backend Application Configuration**: Centralized via Pydantic v2 `BaseSettings` in [`backend/app/config.py`](file:///C:/Projects/SIH/backend/app/config.py), reading from local environment variables or [`backend/.env`](file:///C:/Projects/SIH/backend/.env) with safe development fallbacks.
2. **Frontend Application Configuration**: Managed via Vite's `import.meta.env` system in [`frontend/src/services/api.ts`](file:///C:/Projects/SIH/frontend/src/services/api.ts) and [`frontend/src/services/TrueVoiceStreamClient.ts`](file:///C:/Projects/SIH/frontend/src/services/TrueVoiceStreamClient.ts), reading from [`frontend/.env`](file:///C:/Projects/SIH/frontend/.env).

Both tiers are secured with repository-wide `.gitignore` rules preventing `.env` files from leaking into version control, while version-controlled `.env.example` templates define all configuration contracts.

---

## 2. Environment Variable Inventory & Classification

TrueVoice classifies all environment variables into the following standardized tiers:
* **`REQUIRED_LOCAL`**: Required for local operation; populated with safe local defaults in `.env`.
* **`OPTIONAL_LOCAL`**: Optional for local operation (e.g., Redis, CUDA device, debug flags).
* **`REQUIRED_CLOUD`**: Mandatory in staging/production deployments; left **EMPTY** in local `.env` and `.env.example` templates.
* **`OPTIONAL_CLOUD`**: Optional for staging/production (e.g., Sentry, analytics).
* **`TEST_ONLY`**: Dedicated variables for automated test suites.
* **`BUILD_ONLY`**: Variables used during static compilation and bundling.

### 2.1 Backend Server & Networking

| Variable | Classification | Default (Local Dev) | Production / Cloud Target | Description |
| :--- | :--- | :--- | :--- | :--- |
| `BACKEND_HOST` | `REQUIRED_LOCAL` | `127.0.0.1` | `0.0.0.0` | Host bind address. `127.0.0.1` prevents IPv6/IPv4 lookup confusion on Windows dev machines. |
| `BACKEND_PORT` | `REQUIRED_LOCAL` | `8000` | `8000` (or `$PORT`) | Port for FastAPI Uvicorn ASGI server. |
| `CORS_ORIGINS` | `REQUIRED_LOCAL` | `http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173` | Explicit whitelist e.g. `https://truevoice.bank.com` | Comma-separated list of allowed frontend origins for CORS. |
| `PROJECT_NAME` | `OPTIONAL_LOCAL` | `TrueVoice` | `TrueVoice` | Service display name in API documentation and health status. |
| `VERSION` | `OPTIONAL_LOCAL` | `1.2.0` | `1.2.0` | Current release version string. |
| `ENVIRONMENT` | `REQUIRED_LOCAL` | `development` | `production` | Active runtime profile (`development`, `staging`, `production`, `test`). |
| `DEBUG` | `OPTIONAL_LOCAL` | `true` | `false` | Enables verbose debug logs and stack trace diagnostics. |
| `LOG_LEVEL` | `OPTIONAL_LOCAL` | `INFO` | `INFO` | Logging threshold (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`). |

### 2.2 Security & Authentication

| Variable | Classification | Default (Local Dev) | Production / Cloud Target | Description |
| :--- | :--- | :--- | :--- | :--- |
| `SECRET_KEY` | `REQUIRED_CLOUD` | `truevoice-dev-insecure-secret-key-change-in-production-2026` | Cryptographic random hex (`openssl rand -hex 32`) | HMAC secret for signing JWT access tokens and single-use WebSocket tickets. *Dev placeholder MUST be replaced in production.* |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `OPTIONAL_LOCAL` | `15` | `15` | Expiration window for REST API Bearer JWTs. |
| `WS_TOKEN_EXPIRE_MINUTES` | `OPTIONAL_LOCAL` | `5` | `5` | TTL for single-use WebSocket audio streaming tickets. |

### 2.3 Database & Caching

| Variable | Classification | Default (Local Dev) | Production / Cloud Target | Description |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `REQUIRED_LOCAL` | `postgresql+asyncpg://truevoice:truevoice@localhost:5432/truevoice_db` | Cloud managed RDS / Aurora / Cloud SQL connection string | PostgreSQL 16 connection URL with `pgvector` extension. In cloud environments, credentials must be supplied via secrets manager. |
| `SQLITE_TEST_URL` | `TEST_ONLY` | `sqlite+aiosqlite:///:memory:` | N/A | In-memory SQLite connection for isolated unit testing. |
| `REDIS_URL` | `OPTIONAL_LOCAL` | *(Empty)* | `redis://redis-cluster:6379/0` | Optional Redis URL for real-time pub/sub caching across multiple backend replicas. |

### 2.4 External Cloud Services (Email / Brevo)

> [!IMPORTANT]
> External service credentials are **NOT** stored in the repository. They are intentionally left empty in `.env` and `.env.example`.
> *Reason: Cloud/external credential required; real key is not available locally and must not be fabricated.*

| Variable | Classification | Default (Local Dev) | Production / Cloud Target | Description |
| :--- | :--- | :--- | :--- | :--- |
| `BREVO_API_KEY` | `REQUIRED_CLOUD` | *(Empty)* | `xkeysib-...` | Brevo (Sendinblue) transactional email API key. |
| `BREVO_SENDER_EMAIL` | `REQUIRED_CLOUD` | *(Empty)* | `alerts@truevoice.ai` | Verified sender email address for security notifications. |
| `BREVO_SENDER_NAME` | `REQUIRED_CLOUD` | *(Empty)* | `TrueVoice Security` | Sender display name for transactional emails. |

### 2.5 Machine Learning & Audio Pipeline

| Variable | Classification | Default (Local Dev) | Production / Cloud Target | Description |
| :--- | :--- | :--- | :--- | :--- |
| `TRUEVOICE_ML_MODE` | `REQUIRED_LOCAL` | `mock` | `live` | `mock` enables deterministic fast simulations without checkpoints (for CI/dev); `live` loads PyTorch/SpeechBrain/Whisper. |
| `TRUEVOICE_ML_DEVICE` | `OPTIONAL_LOCAL` | `cpu` | `cuda` (if GPU available) | Execution device for deep learning inference (`cpu` or `cuda`). |
| `DEEPFAKE_PRIMARY_DETECTOR` | `OPTIONAL_LOCAL` | `wav2vec2` | `wav2vec2` | Primary detector architecture (`wav2vec2`, `rawnet2`, `aasist`, `mock`). |
| `TRUEVOICE_WAV2VEC2_MODEL` | `OPTIONAL_LOCAL` | `MelodyMachine/Deepfake-audio-detection-V2` | Hugging Face ID or local path | Checkpoint for Wav2Vec2 detector. |
| `TRUEVOICE_RAWNET2_MODEL` | `OPTIONAL_LOCAL` | *(Empty)* | Checkpoint path | Optional path to RawNet2 weights. |
| `TRUEVOICE_AASIST_MODEL` | `OPTIONAL_LOCAL` | *(Empty)* | Checkpoint path | Optional path to AASIST weights. |
| `SPEAKER_VERIFIER_MODEL` | `OPTIONAL_LOCAL` | `ecapa` | `ecapa` | Speaker verification architecture (ECAPA-TDNN). |
| `SPEAKER_MODEL_SOURCE` | `OPTIONAL_LOCAL` | `speechbrain/spkrec-ecapa-voxceleb` | SpeechBrain model repo | Hugging Face model identifier for ECAPA-TDNN. |
| `TRUEVOICE_SPEAKER_THRESHOLD` | `OPTIONAL_LOCAL` | `0.75` | `0.75` | Configurable operational cosine similarity threshold in `[0.0, 1.0]`. |
| `TRUEVOICE_SPEAKER_DEVICE` | `OPTIONAL_LOCAL` | `cpu` | `cuda` (if GPU) | Hardware device for speaker verification. |
| `ASR_MODEL` | `OPTIONAL_LOCAL` | `faster-whisper-small` | `faster-whisper-small` | ASR pipeline architecture identifier. |
| `TRUEVOICE_ASR_MODEL` | `OPTIONAL_LOCAL` | `small` | `small` | Faster-Whisper model size (`tiny`, `base`, `small`, `medium`, `large-v3`). |
| `TRUEVOICE_ASR_DEVICE` | `OPTIONAL_LOCAL` | `cpu` | `cuda` | Hardware device for ASR transcription. |
| `TRUEVOICE_ASR_COMPUTE_TYPE` | `OPTIONAL_LOCAL` | `int8` | `int8` or `float16` | Quantization type for inference. |
| `TRUEVOICE_ASR_LANGUAGE` | `OPTIONAL_LOCAL` | *(Empty)* | *(Empty)* | Primary language code (leave empty for automatic detection: English, Hindi, Punjabi). |
| `TRUEVOICE_ASR_BEAM_SIZE` | `OPTIONAL_LOCAL` | `5` | `5` | Beam search size for transcription accuracy. |
| `SAMPLE_RATE` | `OPTIONAL_LOCAL` | `16000` | `16000` | Canonical audio sample rate (Hz). |
| `WINDOW_SECONDS` | `OPTIONAL_LOCAL` | `2.0` | `2.0` | DSP sliding analysis window (seconds). |
| `HOP_SECONDS` | `OPTIONAL_LOCAL` | `0.5` | `0.5` | DSP hop interval (seconds). |
| `CHANNELS` | `OPTIONAL_LOCAL` | `1` | `1` | Mono audio stream channels. |

### 2.6 Multi-Signal Fusion & Risk Policy

| Variable | Classification | Default (Local Dev) | Production / Cloud Target | Description |
| :--- | :--- | :--- | :--- | :--- |
| `WEIGHT_DEEPFAKE` | `OPTIONAL_LOCAL` | `0.35` | `0.35` | Baseline risk fusion weight for deepfake ML signal. |
| `WEIGHT_SPEAKER` | `OPTIONAL_LOCAL` | `0.25` | `0.25` | Baseline risk fusion weight for speaker verification. |
| `WEIGHT_CONVERSATION` | `OPTIONAL_LOCAL` | `0.15` | `0.15` | Baseline risk fusion weight for conversational intent NLP. |
| `WEIGHT_CONTEXT` | `OPTIONAL_LOCAL` | `0.15` | `0.15` | Baseline risk fusion weight for operational context anomalies. |
| `WEIGHT_FORENSIC` | `OPTIONAL_LOCAL` | `0.10` | `0.10` | Baseline risk fusion weight for DSP forensic heuristics. |
| `GAMMA_MULTIPLIER` | `OPTIONAL_LOCAL` | `1.35` | `1.35` | Multi-signal compounding non-linear scaling factor. |
| `EMA_ATTACK_ALPHA` | `OPTIONAL_LOCAL` | `0.60` | `0.60` | Fast attack smoothing coefficient for rising risk. |
| `EMA_DECAY_ALPHA` | `OPTIONAL_LOCAL` | `0.20` | `0.20` | Conservative decay smoothing coefficient for declining risk. |
| `CAUTION_THRESHOLD` | `OPTIONAL_LOCAL` | `30.0` | `30.0` | Risk score boundary for `FLAG_MONITOR` tier. |
| `VERIFY_THRESHOLD` | `OPTIONAL_LOCAL` | `60.0` | `60.0` | Risk score boundary for `REQUIRE_OOB_VERIFY` tier. |
| `BLOCK_THRESHOLD` | `OPTIONAL_LOCAL` | `80.0` | `80.0` | Risk score boundary for `TERMINATE_CALL` (block) tier. |
| `SENSITIVE_AMOUNT_THRESHOLD` | `OPTIONAL_LOCAL` | `250000.0` | Configurable | Financial transaction threshold (₹2.5 Lakh) triggering mandatory verification. |
| `OOB_CHALLENGE_TTL_SECONDS` | `OPTIONAL_LOCAL` | `30` | `30` | Out-of-band challenge code time-to-live in seconds. |

### 2.7 Frontend Client Configuration (`VITE_*`)

| Variable | Classification | Default (Local Dev) | Production / Cloud Target | Description |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_APP_ENV` | `REQUIRED_LOCAL` | `development` | `production` | Environment name displayed in UI status badges. |
| `VITE_APP_NAME` | `OPTIONAL_LOCAL` | `TrueVoice` | `TrueVoice` | Application branding name. |
| `VITE_API_BASE_URL` | `OPTIONAL_LOCAL` | *(Empty)* | `https://api.truevoice.bank.com` | Base URL for REST API. When empty in dev, Vite dev server proxies `/v1` and `/health` to `http://127.0.0.1:8000`. |
| `VITE_WS_URL` | `OPTIONAL_LOCAL` | *(Empty)* | `wss://api.truevoice.bank.com` | Base URL for WebSocket streaming. When empty in dev, connects to current host via Vite WebSocket proxy. |
| `VITE_SENTRY_DSN` | `OPTIONAL_CLOUD` | *(Empty)* | Sentry project DSN | Cloud error tracking endpoint for frontend telemetry. |
| `VITE_ANALYTICS_ID` | `OPTIONAL_CLOUD` | *(Empty)* | Analytics property ID | Cloud telemetry / usage analytics property ID. |

---

## 3. Architecture of Vite Proxy vs. Direct URL

In modern web development, browsers enforce the Same-Origin Policy. To prevent Cross-Origin Resource Sharing (CORS) friction and cookie/session discrepancies during local development:

```
+-------------------------------------------------------------+
|                      Browser / Client                       |
|                   http://localhost:3000                     |
+-------------------------------------------------------------+
                               |
                Requests to /v1/auth/login
                WebSocket to /v1/stream/...
                               |
                               v
+-------------------------------------------------------------+
|                Vite Development Server (Port 3000)          |
|  - Serves React SPA bundles                                 |
|  - Configured via frontend/vite.config.ts                   |
|  - Reverse-proxies /v1, /health, /v1/stream                 |
+-------------------------------------------------------------+
                               |
             Forward to http://127.0.0.1:8000 (IPv4)
                               |
                               v
+-------------------------------------------------------------+
|             FastAPI / Uvicorn Backend (Port 8000)           |
|  - Serves REST endpoints (/v1/auth, /v1/sessions, etc.)     |
|  - Serves real-time WebSocket stream (/v1/stream/{id})      |
+-------------------------------------------------------------+
```

### 3.1 Why `127.0.0.1` instead of `localhost`?
On Windows 10/11 and Node.js v18+, `localhost` preferentially resolves to IPv6 `::1`. If Uvicorn is bound exclusively to IPv4 `127.0.0.1:8000`, Node's proxy attempt to connect to `::1:8000` fails immediately with `AggregateError [ECONNREFUSED]`.

By explicitly configuring `target: 'http://127.0.0.1:8000'` with `changeOrigin: true` and `ws: true` in [`frontend/vite.config.ts`](file:///C:/Projects/SIH/frontend/vite.config.ts), Vite cleanly routes all REST and WebSocket connections to the IPv4 listener without DNS resolution delays or connection rejections.

---

## 4. Developer Quickstart Guide

### 4.1 Prerequisites
* Python 3.11+
* Node.js 18+ / npm 9+
* Docker Desktop (optional, for local PostgreSQL/Redis)

### 4.2 Backend Setup
```bash
# 1. From repository root, create your virtual environment if not already present
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Initialize your local .env
# Copy template if backend/.env does not exist:
# cp backend/.env.example backend/.env

# 4. (Optional) Launch PostgreSQL container
docker run -d --name truevoice-postgres -p 5432:5432 -e POSTGRES_USER=truevoice -e POSTGRES_PASSWORD=truevoice -e POSTGRES_DB=truevoice_db pgvector/pgvector:pg16

# 5. Start the FastAPI backend
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend will be available at:
* Health Endpoint: `http://127.0.0.1:8000/health`
* Interactive API Documentation: `http://127.0.0.1:8000/docs`

### 4.3 Frontend Setup
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install npm dependencies
npm install

# 3. Start the Vite development server
npm run dev
```

Frontend will start at: `http://localhost:3000/` and automatically forward `/v1` and WebSocket streaming calls to the backend on `http://127.0.0.1:8000`.
