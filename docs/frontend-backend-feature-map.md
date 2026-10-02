# TrueVoice Frontend-to-Backend Feature Map

This document details the exact mappings between the TrueVoice Frontend React application and the FastAPI backend architecture.

---

## 1. Feature & Endpoint Inventory Matrix

| Feature / UI View | Component | Target Endpoint / Protocol | Request Payload | Response Schema | Proven Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SOC Analyst Authentication** | `AuthModal.tsx` / `LoginModal.tsx` | `POST /v1/auth/login` | `{"email", "password"}` | `TokenResponse` (`access_token`, `role`, `org_id`) | **PROVEN WORKING** |
| **User Profile Verification** | `Header.tsx` | `GET /v1/auth/me` | None (Bearer JWT) | `UserResponse` (`id`, `org_id`, `email`, `role`) | **PROVEN WORKING** |
| **Live Call Session Initiation** | `AudioStreamController.tsx` | `POST /v1/sessions` | `{"caller_ani", "context_metadata"}` | `SessionResponse` (`id`, `current_trust_state`, etc.) | **PROVEN WORKING** |
| **Session Listing** | `IncidentSessionsView.tsx` | `GET /v1/sessions` | Query: `skip`, `limit` | `List[SessionResponse]` | **PROVEN WORKING** |
| **Session Termination** | `AudioStreamController.tsx` | `POST /v1/sessions/{id}/terminate` | None | `SessionResponse` (`TERMINATED` state) | **PROVEN WORKING** |
| **Manual Analyst Override** | `AudioStreamController.tsx` | `POST /v1/sessions/{id}/override` | `{"action", "reason"}` | `SessionResponse` (`TRUSTED`/`RESTRICTED`/`BLOCKED`) | **PROVEN WORKING** |
| **Streaming Ticket Acquisition** | `useRealtimeSession.ts` | `POST /v1/auth/session-token` | `{"session_id"}` | `SessionTokenResponse` (`ticket_token`, TTL) | **PROVEN WORKING** |
| **WebSocket Audio Streaming** | `TrueVoiceStreamClient.ts` | `WS /v1/stream/{session_id}?token=...` | Binary Linear PCM16-LE 16kHz mono | `HANDSHAKE_ACK`, `TELEMETRY`, `PONG` | **PROVEN WORKING** |
| **Microphone Capture** | `pcm-recorder.ts` | Browser Web Audio API (`getUserMedia`) | 16kHz ScriptProcessor / AudioWorklet | PCM16 `ArrayBuffer` | **PROVEN WORKING** |
| **Real-time Risk Gauge** | `RiskGauge.tsx` / `RiskSpeedometer.tsx` | Telemetry event `TELEMETRY` | Ingested via WebSocket | `RiskTelemetryBroadcast.risk_score` (0-100) | **PROVEN WORKING** |
| **Multi-Signal Decomposition** | `SignalRadar.tsx` | Telemetry event `TELEMETRY` | Ingested via WebSocket | `breakdown` (deepfake, speaker, forensic, conv, ctx) | **PROVEN WORKING** |
| **Unenrolled Voiceprint Handling**| `SignalRadar.tsx` | Telemetry event `TELEMETRY` | Ingested via WebSocket | Explicit `N/A (UNENROLLED)` badge (never 0%) | **PROVEN WORKING** |
| **Zero-Trust Policy Enforcements** | `ThreatBadges.tsx` | Telemetry event `TELEMETRY` | Ingested via WebSocket | `security_action` (`ALLOW`, `WARN`, `BLOCK`, etc.) | **PROVEN WORKING** |
| **Live Transcript & Intents** | `TranscriptPanel.tsx` | Telemetry event `TELEMETRY` | Ingested via WebSocket | `transcript_snippet`, `detected_intents` | **PROVEN WORKING** |
| **OOB Challenge Dispatch** | `ChallengeModal.tsx` | `POST /v1/verification/dispatch` | `{"session_id", "challenge_type"}` | `ChallengeResponse` (`challenge_token`, `nonce`) | **PROVEN WORKING** |
| **Challenge Response Submission**| `ChallengeModal.tsx` | `POST /v1/verification/verify?session_id=...` | `{"challenge_token", "nonce", "signature"}`| `VerificationResultSummary` (`SUCCESS`/`REJECTED`) | **PROVEN WORKING** |
| **Biometric Vault Profiles** | `VoiceBiometricsVaultView.tsx` | `GET /v1/speakers` | Query: `skip`, `limit` | `List[SpeakerResponse]` | **PROVEN WORKING** |
| **Speaker Enrollment** | `VoiceBiometricsVaultView.tsx` | `POST /v1/speakers/enroll` | Multipart `FormData` (`audio_files`, name) | `SpeakerResponse` (`has_enrolled_voiceprint`) | **PROVEN WORKING** |
| **Policy Configuration Tuning** | `PolicyTuningView.tsx` | `GET /v1/policies` & `POST /v1/policies` | `PolicyCreate` JSON | `PolicyResponse` (thresholds, lock rules) | **PROVEN WORKING** |
| **Tamper-Evident Audit Ledger** | `AuditLedgerView.tsx` / `AuditViewer.tsx` | `GET /v1/audit/{session_id}/logs` | Path: `session_id` | `List[AuditLogResponse]` ($H_{n-1}, H_n$) | **PROVEN WORKING** |
| **SHA-256 Chain Verification** | `AuditLedgerView.tsx` / `AuditViewer.tsx` | `GET /v1/audit/{session_id}/verify-chain` | Path: `session_id` | `AuditChainValidationResult` (`is_valid: true`) | **PROVEN WORKING** |
| **System Diagnostics & Readiness**| `api.getHealth()` | `GET /health` | None | `{"status": "ONLINE", "database": "HEALTHY"}` | **PROVEN WORKING** |

---

## 2. Telemetry Schema Compliance

The frontend WebSocket stream client (`TrueVoiceStreamClient.ts`) strictly conforms to `app.schemas.risk.RiskTelemetryBroadcast`:

```typescript
export interface RiskTelemetryBroadcast {
  type: 'TELEMETRY';
  session_id: string;
  sequence_id: number;
  timestamp: string;
  risk_score: number;
  risk_tier: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  trust_state: 'OBSERVING' | 'CAUTION' | 'VERIFYING' | 'TRUSTED' | 'RESTRICTED' | 'BLOCKED' | 'HUMAN_REVIEW' | 'TERMINATED';
  breakdown: {
    deepfake: number;
    speaker_similarity: number | null;
    forensic_anomaly: number;
    conversational_threat: number;
    context_sensitivity: number;
  };
  provenance: {
    deepfake?: SignalProvenanceItem;
    speaker_similarity?: SignalProvenanceItem;
    forensic_anomaly?: SignalProvenanceItem;
    conversational_threat?: SignalProvenanceItem;
    context_sensitivity?: SignalProvenanceItem;
    processing_latency_ms?: number;
  };
  security_action: 'ALLOW' | 'WARN' | 'REQUEST_VERIFICATION' | 'RESTRICT' | 'BLOCK' | 'HUMAN_REVIEW';
  detected_intents: string[];
  transcript_snippet: string | null;
}
```

---

## 3. Data Integrity & Fallback Policy
1. **No Simulated Fallbacks in Active Paths**: The frontend does not synthesize fake numbers (`Math.random()`) or fake verification approvals.
2. **Explicit Unenrolled Rendering**: If `speaker_similarity === null` or `signal_availability === 'UNAVAILABLE'`, `SignalRadar.tsx` renders `N/A (UNENROLLED)` and suppresses score percentage calculations.
3. **Session State Transition Synchronization**: Secondary verification outcomes and analyst manual overrides update both local and backend session trust states simultaneously.
