export type RiskTier = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'CAUTION' | 'VERIFY';

export interface RiskFactor {
  id: string;
  name: string;
  category: 'acoustic' | 'biometric' | 'linguistic' | 'telephony' | 'behavioral';
  weight: number;
  rawScore: number; // 0 - 100
  weightedScore: number;
  description: string;
  anomalyDetected: boolean;
}

export interface AudioSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number;
  syntheticScore: number; // 0.0 - 1.0
  frequencyArtifacts: boolean;
  phaseDiscontinuity: boolean;
}

export interface TranscriptToken {
  id: string;
  timeOffset: number; // seconds
  speaker: 'Caller (Target)' | 'Receiver (Analyst)' | 'System';
  text: string;
  threatToken?: {
    keyword: string;
    threatClass: 'URGENCY' | 'FINANCIAL_WIRE' | 'SECRECY' | 'AUTHORITY' | 'SUSPICIOUS_OVERRIDE';
    severity: 'low' | 'medium' | 'high';
  };
}

export interface BiometricIdentity {
  enrolledId: string;
  fullName: string;
  title: string;
  department: string;
  avatarUrl: string;
  ecapaEmbeddingHash: string;
  centroidSamples: number;
  enrolledDate: string;
  similarityScore: number; // 0.0 - 1.0
  matchThreshold: number;
  status: 'VERIFIED_MATCH' | 'IMPERSONATION_MISMATCH' | 'UNREGISTERED_SPEAKER';
}

export interface LockedAction {
  id: string;
  actionName: string;
  category: 'TREASURY' | 'CREDENTIAL_RESET' | 'INFRASTRUCTURE' | 'COMMUNICATION';
  targetResource: string;
  amount?: string;
  lockedAt: string;
  status: 'LOCKED' | 'PENDING_CHALLENGE' | 'RELEASED' | 'REJECTED';
}

export interface ForensicCallScenario {
  id: string;
  title: string;
  badgeText: string;
  type: 'attack' | 'authentic' | 'borderline';
  filename: string;
  fileSize: string;
  audioDuration: number; // seconds
  sampleRate: string;
  codec: string;
  channelMode: string;
  overallRiskScore: number; // 0 - 100
  riskTier: RiskTier;
  compoundingMultiplier: number;
  threatVerdict: string;
  biometric: BiometricIdentity;
  factors: RiskFactor[];
  segments: AudioSegment[];
  transcript: TranscriptToken[];
  lockedActions: LockedAction[];
  forensicSha256: string;
}

export interface IncidentSession {
  id: string;
  callId: string;
  timestamp: string;
  callerLabel: string;
  claimedIdentity: string;
  durationFormatted: string;
  riskScore: number;
  riskTier: RiskTier;
  primaryThreatFlag: string;
  biometricSimilarity: number;
  biometricVerdict: 'MATCH' | 'MISMATCH' | 'UNKNOWN';
  actionsBlockedCount: number;
  forensicHash: string;
  riskProgression: { time: number; score: number }[];
}

export interface AuditBlock {
  blockNumber: number;
  timestamp: string;
  eventType: 'INCIDENT_VERDICT' | 'POLICY_CHANGE' | 'BIOMETRIC_ENROLLMENT' | 'CHALLENGE_ISSUED' | 'ACTION_OVERRIDE';
  callId?: string;
  actor: string;
  details: string;
  previousHash: string;
  blockHash: string;
  verified: boolean;
}

export interface ThreatPolicy {
  cautionThreshold: number; // default 35
  verifyThreshold: number;  // default 65
  blockThreshold: number;   // default 85
  ecapaSimilarityThreshold: number; // default 0.78
  syntheticBurstToleranceSec: number; // default 0.8
  highValueWireLockdown: boolean;
  mfaChallengeAutomatic: boolean;
  telephonyVpnAnomalyBoost: boolean;
}

export interface UserPersona {
  id: string;
  name: string;
  role: 'Tier 1 SOC Analyst' | 'Lead Forensic Investigator' | 'Chief Information Security Officer' | 'Treasury Operations';
  badge: string;
  email: string;
  avatar: string;
}
