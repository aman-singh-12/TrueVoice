/**
 * TrueVoice Real-Time Telemetry Contract Types.
 * Matches backend RiskTelemetryBroadcast schema (app.schemas.risk.RiskTelemetryBroadcast).
 */

export type RiskTier = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type TrustState =
  | 'OBSERVING'
  | 'CAUTION'
  | 'VERIFYING'
  | 'TRUSTED'
  | 'RESTRICTED'
  | 'BLOCKED'
  | 'HUMAN_REVIEW'
  | 'TERMINATED';

export type SecurityActionType =
  | 'ALLOW'
  | 'WARN'
  | 'REQUEST_VERIFICATION'
  | 'RESTRICT'
  | 'BLOCK'
  | 'HUMAN_REVIEW';

export type SignalAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'LOW_CONFIDENCE';

export interface SignalBreakdown {
  deepfake: number;
  speaker_similarity: number;
  forensic_anomaly: number;
  conversational_threat: number;
  context_sensitivity: number;
}

export interface SignalProvenanceItem {
  score?: number;
  signal_availability?: SignalAvailability;
  model_name?: string;
  model_version?: string;
  weight_applied?: number;
  features?: Record<string, unknown>;
}

export interface RiskProvenance {
  deepfake?: SignalProvenanceItem;
  speaker_similarity?: SignalProvenanceItem;
  forensic_anomaly?: SignalProvenanceItem;
  conversational_threat?: SignalProvenanceItem;
  context_sensitivity?: SignalProvenanceItem;
  processing_latency_ms?: number;
  [key: string]: unknown;
}

export interface RiskTelemetryBroadcast {
  type: 'TELEMETRY';
  session_id: string;
  sequence_id: number;
  timestamp: string;
  risk_score: number;
  risk_tier: RiskTier;
  trust_state: TrustState;
  breakdown: SignalBreakdown;
  provenance: RiskProvenance;
  security_action: SecurityActionType;
  detected_intents: string[];
  transcript_snippet: string | null;
}

export interface HandshakeAckMessage {
  type: 'HANDSHAKE_ACK';
  session_id: string;
  status: string;
  source_sample_rate: number;
  analysis_window_seconds: number;
  hop_seconds: number;
}

export interface PongMessage {
  type: 'PONG';
  timestamp?: number;
}

export type ServerWebSocketMessage =
  | RiskTelemetryBroadcast
  | HandshakeAckMessage
  | PongMessage;
