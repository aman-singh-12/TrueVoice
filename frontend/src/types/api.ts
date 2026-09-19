/**
 * TrueVoice REST API Contract Types.
 * Matches backend schemas for auth, sessions, risk, verification, and audit ledger.
 */

import type { RiskTier, TrustState } from './telemetry';

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

