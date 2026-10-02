/**
 * TrueVoice REST API Contract Types.
 * Matches backend schemas for auth, sessions, risk, verification, and audit ledger.
 */

import type { RiskTier, TrustState, SecurityActionType, SignalAvailability } from './telemetry';
export type { RiskTier, TrustState, SecurityActionType, SignalAvailability };

export type UserRole =
  | 'OPERATOR'
  | 'SECURITY_ANALYST'
  | 'ORG_ADMIN'
  | 'FORENSIC_AUDITOR';

export type ChallengeType = 'OOB_PUSH' | 'IN_BAND_CHALLENGE' | 'SECURE_CALLBACK';
export type ChallengeStatus = 'PENDING' | 'SUCCESS' | 'TIMEOUT' | 'REJECTED';

export type AuditEventType =
  | 'SESSION_CREATED'
  | 'ANALYSIS_CHUNK_EVALUATED'
  | 'STATE_TRANSITION'
  | 'POLICY_ENFORCED'
  | 'CHALLENGE_DISPATCHED'
  | 'CHALLENGE_VERIFIED'
  | 'ANALYST_OVERRIDE'
  | 'SESSION_TERMINATED';

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
  organization_name?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
  user_id: string;
  org_id: string;
  role: UserRole;
}

export interface UserResponse {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface SessionTokenRequest {
  session_id: string;
}

export interface SessionTokenResponse {
  ticket_token: string;
  token_type: string;
  expires_in_seconds: number;
  session_id: string;
}

// Session
export interface SessionCreate {
  claimed_speaker_id?: string | null;
  caller_ani?: string;
  context_metadata?: Record<string, unknown>;
}

export interface SessionResponse {
  id: string;
  org_id: string;
  session_token: string;
  claimed_speaker_id: string | null;
  caller_ani: string;
  current_trust_state: TrustState;
  peak_risk_score: number;
  started_at: string;
  ended_at: string | null;
}

export interface SessionDetailResponse extends SessionResponse {
  context_metadata: Record<string, unknown>;
  recent_assessments_count: number;
}

export interface AnalystOverrideRequest {
  action: 'ANALYST_APPROVE' | 'ANALYST_RESTRICT' | 'ANALYST_BLOCK';
  reason: string;
}

// Risk Assessment Timeline
export interface RiskAssessmentResponse {
  id: string;
  session_id: string;
  sequence_id: number;
  synthetic_prob: number;
  speaker_similarity: number | null;
  forensic_score: number;
  conversational_score: number;
  composite_risk: number;
  risk_tier: RiskTier;
  primary_factors: string[];
  evidence_provenance: Record<string, unknown>;
  recorded_at: string;
}

// Verification Challenges
export interface ChallengeDispatch {
  session_id: string;
  challenge_type?: ChallengeType;
}

export interface ChallengeResponse {
  challenge_token: string;
  session_id: string;
  challenge_type: ChallengeType;
  nonce: string;
  expires_at: string;
  ttl_seconds: number;
  instructions: string;
}

export interface VerificationSubmit {
  challenge_token: string;
  nonce: string;
  signature: string;
}

export interface VerificationResultSummary {
  session_id: string;
  status: ChallengeStatus;
  message: string;
  verified_at: string | null;
}

// Audit Ledger
export interface AuditLogResponse {
  id: string;
  session_id: string;
  sequence_id: number;
  event_type: AuditEventType;
  prev_event_hash: string;
  event_hash: string;
  trust_state: TrustState;
  payload_json: Record<string, unknown>;
  created_at: string;
}

export interface AuditChainValidationResult {
  session_id: string;
  total_events: number;
  is_valid: boolean;
  verified_at: string;
  tampered_at_sequence: number | null;
  message: string;
}

// Speaker Biometrics
export interface SpeakerResponse {
  id: string;
  org_id: string;
  display_name: string;
  designation: string;
  is_active: boolean;
  created_at: string;
  has_enrolled_voiceprint: boolean;
}

// Policies
export interface PolicyCreate {
  policy_name: string;
  caution_threshold: number;
  verify_threshold: number;
  block_threshold: number;
  enforce_transaction_lock?: boolean;
  sensitive_amount_threshold?: number;
  oob_timeout_seconds?: number;
  version?: string;
}

export interface PolicyResponse extends PolicyCreate {
  id: string;
  org_id: string;
  created_at: string;
}

// Audio File Analysis Contracts
export interface AudioFileMetadata {
  filename: string;
  size_bytes: number;
  duration_seconds: number;
  sample_rate: number;
  channels: number;
  format: string;
}

export interface DeepfakeSignalDetail {
  score: number;
  label: string;
  confidence: number | null;
  signal_availability: SignalAvailability;
  model_name: string;
  model_version: string;
  inference_time_ms: number;
}

export interface SpeakerSignalDetail {
  similarity: number | null;
  threshold: number;
  is_match: boolean | null;
  confidence: number | null;
  signal_availability: SignalAvailability;
  model_name: string;
  model_version: string;
  inference_time_ms: number;
}

export interface ForensicsSignalDetail {
  score: number;
  signal_availability: SignalAvailability;
  f0_mean: number | null;
  f0_std: number | null;
  jitter_local: number | null;
  shimmer_local: number | null;
  hnr_db: number | null;
  spectral_centroid_mean: number | null;
  spectral_rolloff_mean: number | null;
  spectral_flux_mean: number | null;
  rms_energy_mean: number | null;
  anomalies_detected: string[];
  evidence: string[];
  model_name: string;
  model_version: string;
}

export interface ConversationSignalDetail {
  threat_score: number;
  detected_intents: string[];
  transcript: string | null;
  language: string | null;
  confidence: number | null;
  signal_availability: SignalAvailability;
  model_name: string;
  model_version: string;
}

export interface ContextSignalDetail {
  score: number;
  signal_availability: SignalAvailability;
  risk_factors: string[];
  features: Record<string, unknown>;
}

export interface AnalysisSignals {
  deepfake: DeepfakeSignalDetail;
  speaker: SpeakerSignalDetail;
  forensics: ForensicsSignalDetail;
  conversation: ConversationSignalDetail;
  context: ContextSignalDetail;
}

export interface AnalysisModelProvenance {
  deepfake_model: string;
  deepfake_model_version: string;
  speaker_model: string;
  speaker_model_version: string;
  asr_model: string;
  asr_model_version: string;
  ml_mode: string;
  ml_device: string;
}

export interface AudioAnalysisResponse {
  analysis_id: string;
  status: string;
  created_at: string;
  reference_audio: AudioFileMetadata;
  suspected_audio: AudioFileMetadata;

  // Primary Verdicts
  risk_score: number;
  risk_tier: RiskTier;
  trust_state: TrustState;
  security_action: SecurityActionType;
  action_reason: string;
  rule_matched: string;

  // Evidence and Provenance
  primary_factors: string[];
  evidence: string[];

  // Granular Signal Breakdown
  signals: AnalysisSignals;

  // Engine & Model Provenance
  provenance: AnalysisModelProvenance;

  // Execution Timing
  pipeline_stages_completed: string[];
  total_processing_time_ms: number;
}

