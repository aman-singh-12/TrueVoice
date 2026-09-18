# TrueVoice Contract Gaps & Discrepancy Report

**Document Version:** 1.0.0  
**Audit Date:** September 18, 2026  
**Status:** Grounded Audit Findings  
**Scope:** Discrepancies between approved architecture/specifications and actual codebase implementation across API routes, Pydantic schemas, SQLAlchemy models, and service business logic.

---

## 1. Executive Summary

This report catalogues all contract mismatches, architectural gaps, and implementation inconsistencies identified during the code-level audit of the TrueVoice backend. Each entry provides reproducible evidence from the source code, severity ranking, and targeted remediation recommendations without altering the underlying code.

### Summary by Severity

| Severity | Count | Primary Impact |
| :--- | :---: | :--- |
| **CRITICAL** | **0** | No tenant breaches, data corruption, or breaking crashes in the primary pipeline. |
| **HIGH** | **2** | Biometric data stored in plaintext; runtime exception in unexercised conversational recording path. |
| **MEDIUM** | **4** | Missing container readiness probe, missing WebSocket frame limits, unpopulated FK linkage, classical VAD in place of neural. |
| **LOW** | **2** | Inconsistent error payload schema on validation failure, missing export endpoint. |
| **INFORMATIONAL** | **1** | Frontend client codebase not yet in repository. |
| **Total Findings** | **9** | Complete system gap inventory. |

---

## 2. Detailed Contract Gap Inventory

### GAP-01: Plaintext Biometric Vector Storage at Rest
- **ID:** `GAP-01`
- **Severity:** `HIGH`
- **Component:** Biometric Persistence / `SpeakerService` / `VoiceprintEmbedding`
- **Current Behavior:** The `voiceprint_embeddings.embedding` column stores 192-dimensional floating-point vectors directly in PostgreSQL via `Vector(192)` or as JSON-serialized text in SQLite. The biometric numbers are completely unencrypted.
- **Expected Behavior:** Per PRD §5.2 and HLD §8.3, voiceprint biometric templates must be encrypted at rest using AES-256-GCM envelope encryption or cryptographic key management service (KMS) hashing to prevent exfiltration.
- **Evidence:** [`backend/app/models/speaker_profile.py:41`](file:///c:/Projects/SIH/backend/app/models/speaker_profile.py#L41)
  ```python
  embedding = Column(Vector192, nullable=False)
  ```
- **Recommended Fix:** Introduce an AES-256-GCM encryption wrapper in `Vector192.process_bind_param` and decrypt in `process_result_value`, or store encrypted ciphertext in an adjacent column with envelope key rotation.
- **Implementation Required:** `YES` (Prior to production deployment)

---

### GAP-02: Column Mismatch on `ConversationAnalysis` Entity in `RiskService`
- **ID:** `GAP-02`
- **Severity:** `HIGH`
- **Component:** Database Schema / `RiskService`
- **Current Behavior:** In [`backend/app/services/risk_service.py:98-99`](file:///c:/Projects/SIH/backend/app/services/risk_service.py#L98), `record_conversation_analysis()` attempts to instantiate `ConversationAnalysis` with arguments `threat_level=threat_level` and `confidence=confidence`. However, the `ConversationAnalysis` SQLAlchemy model and Alembic migration `001_initial_schema.py` define only `id`, `session_id`, `sequence_id`, `transcript_redacted`, `detected_intent_flags`, and `recorded_at`. If speech transcription is triggered, SQLAlchemy raises a `TypeError: 'threat_level' is an invalid keyword argument for ConversationAnalysis`.
- **Expected Behavior:** Model attributes must exactly mirror the service instantiation arguments, or the service must only pass defined model fields.
- **Evidence:**
  - Model: [`backend/app/models/risk_assessment.py:37-49`](file:///c:/Projects/SIH/backend/app/models/risk_assessment.py#L37)
  - Service: [`backend/app/services/risk_service.py:93-100`](file:///c:/Projects/SIH/backend/app/services/risk_service.py#L93)
- **Recommended Fix:** Either add `threat_level` (`String(32)`) and `confidence` (`Float`) columns to `ConversationAnalysis` in a new Alembic migration, or remove those keyword arguments from `record_conversation_analysis()`.
- **Implementation Required:** `YES`

---

### GAP-03: Unpopulated `model_version_id` Foreign Key on `RiskAssessment`
- **ID:** `GAP-03`
- **Severity:** `MEDIUM`
- **Component:** Machine Learning Provenance / `RiskService`
- **Current Behavior:** The `risk_assessments` database table defines a foreign key `model_version_id` referencing `model_versions.id`. However, during runtime evaluation, `RiskService.record_assessment()` receives `model_version_id: Optional[UUID] = None` and writes `NULL` to this column.
- **Expected Behavior:** Every risk assessment row should link to the active primary deepfake detector's entry in `model_versions` for complete algorithmic provenance and model drift tracking.
- **Evidence:** [`backend/app/services/risk_service.py:42-57`](file:///c:/Projects/SIH/backend/app/services/risk_service.py#L42)
- **Recommended Fix:** In `audio_service.py`, resolve the active model ID from `ModelVersion` during startup and pass it to `risk_service.record_assessment()`.
- **Implementation Required:** `YES`

---

### GAP-04: Missing Readiness Health Probe (`/ready`)
- **ID:** `GAP-04`
- **Severity:** `MEDIUM`
- **Component:** Operational Health API / `main.py`
- **Current Behavior:** The API provides `/health` and `/v1/health` returning basic operational status, but lacks a dedicated `/ready` probe.
- **Expected Behavior:** Kubernetes and cloud load balancers require distinct `/live` (liveness) and `/ready` (readiness) endpoints. The `/ready` probe must verify database connectivity (`SELECT 1`), Redis reachability, and resident ML model weights readiness before admitting live client traffic.
- **Evidence:** [`backend/app/main.py`](file:///c:/Projects/SIH/backend/app/main.py)
- **Recommended Fix:** Implement `GET /ready` in `backend/app/api/routes/health.py` that executes deep health diagnostics and returns HTTP 503 if dependencies are offline.
- **Implementation Required:** `YES`

---

### GAP-05: Unbounded Frame Size on Audio Streaming WebSocket
- **ID:** `GAP-05`
- **Severity:** `MEDIUM`
- **Component:** Real-Time Ingestion / `websocket_audio_stream`
- **Current Behavior:** The WebSocket endpoint awaits `websocket.receive()` and directly ingests any binary chunk into the audio preprocessor without validating maximum frame payload size.
- **Expected Behavior:** WebSocket streaming endpoints must reject incoming binary frames larger than 64 KB (1 second of 16kHz 16-bit mono audio is 32,000 bytes) to defend against memory exhaustion (OOM DoS attacks).
- **Evidence:** [`backend/app/api/websocket/audio_stream.py:101-105`](file:///c:/Projects/SIH/backend/app/api/websocket/audio_stream.py#L101)
- **Recommended Fix:** Check `len(message["bytes"]) > 65536` in `websocket_audio_stream` and close connection with `WS_1009_MESSAGE_TOO_BIG`.
- **Implementation Required:** `YES`

---

### GAP-06: Classical Energy VAD in Place of Neural Silero VAD
- **ID:** `GAP-06`
- **Severity:** `MEDIUM`
- **Component:** Audio Preprocessing / `AudioPipeline`
- **Current Behavior:** Voice Activity Detection (VAD) is implemented via simple RMS energy thresholding (-45 dBFS) with an adaptive background noise tracker in [`backend/app/audio/vad.py`](file:///c:/Projects/SIH/backend/app/audio/vad.py).
- **Expected Behavior:** LLD §3.3 specifies a neural Silero VAD model packaged in ONNX format with a 512-sample chunk stride for noise-robust speech boundary segmentation.
- **Evidence:** [`backend/app/audio/vad.py:EnergyVAD`](file:///c:/Projects/SIH/backend/app/audio/vad.py)
- **Recommended Fix:** Add `silero_vad.onnx` inference engine to `app/audio/vad.py` with automatic fallback to `EnergyVAD` if ONNXRuntime is not installed.
- **Implementation Required:** `YES`

---

### GAP-07: Inconsistent Error Payload Formatting for Pydantic Validation Errors
- **ID:** `GAP-07`
- **Severity:** `LOW`
- **Component:** Global Error Handling / `main.py`
- **Current Behavior:** Custom exceptions (`AuthenticationError`, `AuthorizationError`, `TenantAccessViolation`, etc.) return a standardized JSON structure `{"detail": "...", "error_code": "...", "details": {...}}`. However, standard FastAPI 422 Unprocessable Entity errors from Pydantic input validation bypass these handlers and return `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}`.
- **Expected Behavior:** All API errors, including schema validation failures, should adhere to a unified error envelope format so frontend clients can handle errors predictably.
- **Evidence:** [`backend/app/main.py:82-140`](file:///c:/Projects/SIH/backend/app/main.py#L82)
- **Recommended Fix:** Register an `@app.exception_handler(RequestValidationError)` that wraps validation errors into `{"detail": "Request validation failed", "error_code": "VALIDATION_ERROR", "details": exc.errors()}`.
- **Implementation Required:** `NO` (Cosmetic improvement for frontend integration)

---

### GAP-08: Missing Standalone Audit Log Export Endpoint (`/v1/audit/{id}/export`)
- **ID:** `GAP-08`
- **Severity:** `LOW`
- **Component:** Audit Ledger API / `backend/app/api/routes/audit.py`
- **Current Behavior:** Audit log entries can be queried as a JSON list via `GET /v1/audit/{session_id}/logs`, and verified via `GET /v1/audit/{session_id}/verify-chain`. A dedicated export endpoint (`/export`) returning an immutable downloadable artifact is absent.
- **Expected Behavior:** PRD §4.6 specifies an export route returning canonical RFC 8785 JSON formatted specifically for forensic evidence submission.
- **Evidence:** [`backend/app/api/routes/audit.py`](file:///c:/Projects/SIH/backend/app/api/routes/audit.py)
- **Recommended Fix:** Add `GET /v1/audit/{session_id}/export` returning a downloadable `application/json` file containing the complete chain and cryptographic validation status.
- **Implementation Required:** `NO`

---

### GAP-09: Absence of Frontend Application Code
- **ID:** `GAP-09`
- **Severity:** `INFORMATIONAL`
- **Component:** Repository Structure / Frontend
- **Current Behavior:** The repository currently contains backend Python code, documentation, and static font assets in `public/fonts`, but no frontend React/Next.js client code.
- **Expected Behavior:** The frontend will consume the API contract documented in `API_CONTRACT.md`.
- **Evidence:** Workspace root search shows no `package.json` or frontend source directory.
- **Recommended Fix:** Ensure future frontend development strictly consumes the schemas and WebSocket telemetry frames documented in `API_CONTRACT.md`.
- **Implementation Required:** `NO`
