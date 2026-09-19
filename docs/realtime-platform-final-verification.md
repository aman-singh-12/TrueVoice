# TrueVoice — Person 4: Real-Time Platform + Frontend
## Final Read-Only Verification Audit Report

**Branch:** `feature/realtime-platform`  
**Audit Date:** 2026-09-18  
**Audit Type:** Strict Read-Only Implementation Verification  
**Final Verdict:** **READY WITH GAPS**  

---

### 1. Automated Tests

#### Backend Automated Test Suite
- **Command:** `python -m pytest tests/ -v`
- **Working Directory:** `backend/`
- **Result:** **30 passed in 2.37s**
- **Failures:** 0
- **Skipped:** 0
- **Breakdown:**
  - 5 REST API integration tests (health, auth, session lifecycle, policy, verification/audit)
  - 4 WebSocket streaming integration tests (ticket auth, 64KB frame rejection, PING/PONG, telemetry broadcast)
  - 21 Unit tests (audio DSP, circular buffer, VAD, audit hash chaining, acoustic forensics, risk fusion, zero-trust FSM, OOB verification)

#### Frontend Automated Test Suite
- **Command:** `npm test` (`vitest run`)
- **Working Directory:** `frontend/`
- **Result:** **4 test files passed, 11 tests passed in 3.04s**
- **Failures:** 0
- **Breakdown:**
  - `RiskGauge.test.tsx` (3 tests: active state, standby state, score clamping)
  - `SignalRadar.test.tsx` (2 tests: 5-signal rendering, explicit `N/A (UNENROLLED)` display)
  - `TrueVoiceStreamClient.test.ts` (4 tests: handshake sync, telemetry dispatch, 64KB chunk guard, clean disconnect)
  - `ChallengeModal.test.tsx` (2 tests: countdown/nonce display, backend verification submission)

#### Frontend Production Build
- **Command:** `npm run build` (`tsc -b && vite build`)
- **Result:** **Success (0 errors, 153ms)**
- **Output Artifacts:** `dist/index.html` (0.45 kB), `dist/assets/index-*.css` (14.82 kB), `dist/assets/index-*.js` (259.44 kB).

---

### 2. WebSocket Ticket

An in-depth inspection of `backend/app/api/routes/auth.py`, `backend/app/core/security.py`, and `backend/app/api/websocket/audio_stream.py` revealed:

| Property | Value / Behavior | Code Evidence |
| :--- | :--- | :--- |
| **Time-Limited** | **YES** | Enforces JWT standard `exp` claim via `datetime.now(timezone.utc) + expires_delta`. |
| **Exact TTL** | **300 seconds (5 minutes)** | `settings.ws_ticket_expire_seconds: int = 300` in `backend/app/config.py`. |
| **Single-Use** | **NO** | The server checks JWT signature and `exp`, but does **not** check a token blocklist or mark `jti` as consumed in Redis/PostgreSQL. |
| **Single-Use Enforcement** | **Nowhere** | No revocation table or cache exists in the WebSocket connection handler. |
| **Reusability within TTL** | **YES** | The same ticket string can be presented to establish multiple concurrent or sequential connections until the 300s window expires. |
| **Session-Scoped** | **YES** | Token contains `claims["session_id"] == session_id` and `claims["scope"] == "websocket_stream"`. If path `session_id` does not match, connection closes with code `1008`. |
| **Tenant-Scoped** | **YES** | Token contains `claims["org_id"]`. The endpoint verifies that the resolved session record in PostgreSQL belongs to `claims["org_id"]`. |
| **Revocable** | **NO** | Standard stateless JWT without an active revocation store. |

*Identified Gap:* WebSocket ticket single-use enforcement requires a fast Redis or DB `jti` consumption check upon connection accept.

---

### 3. Audio Capture Implementation

An inspection of `frontend/src/audio/pcm-recorder.ts` and `frontend/src/services/TrueVoiceStreamClient.ts` revealed:

- **Capture Mechanism:** **`ScriptProcessorNode`** via Web Audio API.
  - Implemented as: `this.audioContext.createScriptProcessor(4096, 1, 1)` attached to `MediaStreamAudioSourceNode`.
  - Does **not** use `AudioWorkletNode` or `MediaRecorder`.
- **Wire Delivery Verification:**
  1. `navigator.mediaDevices.getUserMedia(...)` captures live mic stream `MediaStream`.
  2. `AudioContext.createMediaStreamSource(mediaStream)` creates audio graph source.
  3. `ScriptProcessorNode.onaudioprocess` extracts raw mono Float32 samples from `event.inputBuffer.getChannelData(0)`.
  4. `PcmRecorder.resampleLinear()` interpolates samples to 16,000 Hz if hardware rate differs.
  5. `PcmRecorder.floatToPcm16LE()` converts Float32 `[-1.0, 1.0]` to signed 16-bit little-endian PCM bytes (`ArrayBuffer`).
  6. Emitted to `useRealtimeSession` callback -> calls `TrueVoiceStreamClient.sendAudioChunk(chunk)`.
  7. Calls `this.ws.send(chunk)` -> delivers binary frame across WebSocket to FastAPI endpoint.
- **Delivery Verdict:** Captured microphone audio **actually reaches** `microphone → PCM conversion → WebSocket.send()`.

---

### 4. Oversized Frame Protection

An inspection of `backend/app/api/websocket/audio_stream.py:104-109`:

```python
if "bytes" in message and message["bytes"]:
    raw_chunk = message["bytes"]
    if len(raw_chunk) > 65536:
        logger.warning(f"Rejecting oversized audio frame ({len(raw_chunk)} bytes) for session {session_id}")
        await websocket.close(code=status.WS_1009_MESSAGE_TOO_BIG, reason="Audio frame exceeds 64KB limit")
        return
```

- **Protection Behavior:** **REJECTED ENTIRELY** with WebSocket close code `1009 MESSAGE_TOO_BIG`.
- **Truncation Check:** Audio is **NOT truncated or clamped**. Oversized frames immediately terminate the WebSocket connection.
- **Client Protection:** `TrueVoiceStreamClient.sendAudioChunk()` also checks `chunk.byteLength > 65536` and drops the frame (`return false`) before wire transmission.

---

### 5. Manual E2E Status

- **Status:** **`MANUAL E2E: UNVERIFIED`**
- **Rationale:** While all automated backend integration tests and frontend component tests pass completely, a live, physical end-to-end browser session with real human voice input, interactive mic prompt approval, and visual HUD observation was not executed in this headless verification environment.

---

### 6. Security & JWT Storage

An inspection of `frontend/src/services/api.ts:30-55`:

- **Storage Location:** 
  - Stored in-memory in the `ApiClient` instance (`private token: string | null`).
  - Persisted in **`sessionStorage`** (`sessionStorage.getItem('tv_token')` / `sessionStorage.setItem('tv_token', ...)`).
  - Not stored in `localStorage` or browser cookies.
- **Token Logging:** No JWT tokens, passwords, or Authorization headers are logged to `console.log`.
- **Secret Exposure:** Zero backend secrets (`SECRET_KEY`, database credentials, API keys) exist in frontend source or build artifacts.
- **Security Implications:**
  - `sessionStorage` provides tab isolation and clears on window close.
  - However, `sessionStorage` is accessible to JavaScript on the origin and vulnerable to XSS; migration to `HttpOnly`, `SameSite=Strict` cookies is recommended for high-assurance production deployments.

---

### 7. Protected Components Diff

Verified via `git diff main --stat`:

| Component Group | Status |
| :--- | :--- |
| Wav2Vec2 Detection Model | **UNTOUCHED** |
| RawNet2 Detection Model | **UNTOUCHED** |
| AASIST Detection Model | **UNTOUCHED** |
| ECAPA-TDNN Speaker Verification | **UNTOUCHED** |
| Whisper ASR Pipeline | **UNTOUCHED** |
| Audio DSP / Preprocessing Algorithms | **UNTOUCHED** |
| Risk Fusion Formula & Weights | **UNTOUCHED** |
| Risk Decision Thresholds | **UNTOUCHED** |
| Declarative Policy Rules | **UNTOUCHED** |
| Zero-Trust State Machine Logic | **UNTOUCHED** |
| SHA-256 Audit Hash Chain Algorithm | **UNTOUCHED** |
| PostgreSQL Database Schema & Migrations | **UNTOUCHED** |

---

### 8. Final Verdict

# **READY WITH GAPS**

#### Summary of Gaps to Address Before Production:
1. **WebSocket Ticket Single-Use:** The 5-minute ticket token is session- and tenant-scoped, but allows replay within its 300s TTL because `jti` consumption is not tracked in a fast cache (e.g., Redis).
2. **Web Audio Capture API:** Uses `ScriptProcessorNode` (widely supported and functional) rather than modern `AudioWorkletNode`.
3. **Manual Browser E2E:** Full browser-to-mic human voice flow remains `UNVERIFIED` until tested on physical client hardware.
