import { ForensicCallScenario, IncidentSession, BiometricIdentity, AuditBlock, ThreatPolicy, UserPersona } from '../types';

export const personas: UserPersona[] = [
  {
    id: 'p1',
    name: 'Elena Rostova',
    role: 'Lead Forensic Investigator',
    badge: 'SOC-FORENSIC-L3',
    email: 'e.rostova@enterprise.internal',
    avatar: 'ER'
  },
  {
    id: 'p2',
    name: 'Marcus Vance',
    role: 'Chief Information Security Officer',
    badge: 'CISO-EXEC-01',
    email: 'm.vance@enterprise.internal',
    avatar: 'MV'
  },
  {
    id: 'p3',
    name: 'Devon Miller',
    role: 'Tier 1 SOC Analyst',
    badge: 'SOC-ANALYST-T1',
    email: 'd.miller@enterprise.internal',
    avatar: 'DM'
  }
];

export const scenarioAttack: ForensicCallScenario = {
  id: 'SCN-ESCROW-ATTACK-092',
  title: '🔴 Critical Impersonation: Deepfake Escrow Attack',
  badgeText: 'CRITICAL THREAT DETECTED',
  type: 'attack',
  filename: 'call_rec_2026_09_18_urgent_escrow_wire_cf0.wav',
  fileSize: '4.2 MB',
  audioDuration: 32.0,
  sampleRate: '16.0 kHz (PCM-16)',
  codec: 'Telephony G.711u / High-Res Re-encode',
  channelMode: 'Dual Channel (Inbound / Agent)',
  overallRiskScore: 88.4,
  riskTier: 'CRITICAL',
  compoundingMultiplier: 1.45,
  threatVerdict: 'SYNTHETIC CLONE + HIGH-VALUE WIRE INTERCEPT BLOCKED',
  forensicSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  biometric: {
    enrolledId: 'BIO-EXEC-004',
    fullName: 'Sarah Jenkins',
    title: 'Chief Financial Officer',
    department: 'Global Treasury & Finance',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    ecapaEmbeddingHash: '0x8f4d92a17e0c4b22...192d_centroid',
    centroidSamples: 42,
    enrolledDate: '2025-11-14',
    similarityScore: 0.38,
    matchThreshold: 0.78,
    status: 'IMPERSONATION_MISMATCH'
  },
  factors: [
    {
      id: 'f1',
      name: 'Acoustic Synthetic Artifacts',
      category: 'acoustic',
      weight: 0.35,
      rawScore: 94.0,
      weightedScore: 32.9,
      description: 'Severe phase discontinuities & unnatural Mel-frequency spectral envelope detected between 4.2s-11.8s & 22.0s-29.5s.',
      anomalyDetected: true
    },
    {
      id: 'f2',
      name: 'ECAPA-TDNN Biometric Mismatch',
      category: 'biometric',
      weight: 0.30,
      rawScore: 92.0,
      weightedScore: 27.6,
      description: 'Cosine similarity 0.38 is radically below the enterprise threshold of 0.78 against enrolled CFO voice centroid.',
      anomalyDetected: true
    },
    {
      id: 'f3',
      name: 'Social Engineering & Urgent Wording',
      category: 'linguistic',
      weight: 0.20,
      rawScore: 85.0,
      weightedScore: 17.0,
      description: 'High-density triggers for offshore escrow routing, bypassing dual-custody authorization, and false urgency.',
      anomalyDetected: true
    },
    {
      id: 'f4',
      name: 'Telephony Route & CDR Anomalies',
      category: 'telephony',
      weight: 0.10,
      rawScore: 78.0,
      weightedScore: 7.8,
      description: 'Inbound SIP trunk spoofed with mismatched originating carrier AS-path from unverified foreign proxy.',
      anomalyDetected: true
    },
    {
      id: 'f5',
      name: 'Temporal Stress & Cadence Flux',
      category: 'behavioral',
      weight: 0.05,
      rawScore: 62.0,
      weightedScore: 3.1,
      description: 'Unnatural syllable prosody; micro-tremor variance indicates text-to-speech neural vocoder synthesis.',
      anomalyDetected: true
    }
  ],
  segments: [
    { id: 'seg-1', startTime: 0.0, endTime: 3.8, syntheticScore: 0.12, frequencyArtifacts: false, phaseDiscontinuity: false },
    { id: 'seg-2', startTime: 3.8, endTime: 12.4, syntheticScore: 0.96, frequencyArtifacts: true, phaseDiscontinuity: true },
    { id: 'seg-3', startTime: 12.4, endTime: 18.2, syntheticScore: 0.24, frequencyArtifacts: false, phaseDiscontinuity: false },
    { id: 'seg-4', startTime: 18.2, endTime: 29.8, syntheticScore: 0.94, frequencyArtifacts: true, phaseDiscontinuity: true },
    { id: 'seg-5', startTime: 29.8, endTime: 32.0, syntheticScore: 0.31, frequencyArtifacts: false, phaseDiscontinuity: false }
  ],
  transcript: [
    {
      id: 't1',
      timeOffset: 0.8,
      speaker: 'Receiver (Analyst)',
      text: 'Good afternoon, Treasury Desk. Analyst Miller speaking, how can I direct your call?'
    },
    {
      id: 't2',
      timeOffset: 4.2,
      speaker: 'Caller (Target)',
      text: 'Devon, this is Sarah Jenkins. I am calling from the Frankfurt acquisition meeting and we are facing a strict closing deadline.',
      threatToken: {
        keyword: 'strict closing deadline',
        threatClass: 'URGENCY',
        severity: 'medium'
      }
    },
    {
      id: 't3',
      timeOffset: 8.5,
      speaker: 'Caller (Target)',
      text: 'I need you to bypass normal dual-signoff and release $2,450,000 to the Apex Capital escrow account right now.',
      threatToken: {
        keyword: 'bypass normal dual-signoff / release $2,450,000',
        threatClass: 'FINANCIAL_WIRE',
        severity: 'high'
      }
    },
    {
      id: 't4',
      timeOffset: 14.1,
      speaker: 'Receiver (Analyst)',
      text: 'Understood, Ms. Jenkins. However, policy requires an out-of-band hardware token verification for amounts over $500k.'
    },
    {
      id: 't5',
      timeOffset: 19.5,
      speaker: 'Caller (Target)',
      text: 'Do not delay this! If this wire is not completed within 10 minutes, the merger defaults. Keep this confidential and execute immediately!',
      threatToken: {
        keyword: 'Keep this confidential and execute immediately',
        threatClass: 'SECRECY',
        severity: 'high'
      }
    },
    {
      id: 't6',
      timeOffset: 26.3,
      speaker: 'Caller (Target)',
      text: 'I will personally sign off on the audit log as soon as I land back in New York.',
      threatToken: {
        keyword: 'personally sign off / audit bypass',
        threatClass: 'AUTHORITY',
        severity: 'medium'
      }
    }
  ],
  lockedActions: [
    {
      id: 'ACT-TR-0981',
      actionName: 'SWIFT International Wire $2,450,000.00 USD',
      category: 'TREASURY',
      targetResource: 'Apex Capital Escrow (IBAN: CH93-0000-4910-2911-A)',
      amount: '$2,450,000.00',
      lockedAt: '14:22:19 UTC',
      status: 'LOCKED'
    },
    {
      id: 'ACT-AUTH-0982',
      actionName: 'Dual-Signoff Treasury Policy Override',
      category: 'CREDENTIAL_RESET',
      targetResource: 'Treasury Core Vault Rule #SEC-819',
      lockedAt: '14:22:21 UTC',
      status: 'LOCKED'
    },
    {
      id: 'ACT-OOB-0983',
      actionName: 'Out-of-Band Hardware Push Challenge',
      category: 'COMMUNICATION',
      targetResource: 'Sarah Jenkins Authenticator Hardware Token #883',
      lockedAt: '14:22:23 UTC',
      status: 'PENDING_CHALLENGE'
    }
  ]
};

export const scenarioAuthentic: ForensicCallScenario = {
  id: 'SCN-EXEC-AUTH-011',
  title: '🟢 Authentic Executive: Routine Infra Review',
  badgeText: 'IDENTITY VERIFIED & CLEAN',
  type: 'authentic',
  filename: 'call_rec_2026_09_18_routine_quarterly_ops_mv.wav',
  fileSize: '3.8 MB',
  audioDuration: 28.5,
  sampleRate: '16.0 kHz (PCM-16)',
  codec: 'WebRTC Opus 48kHz downsampled / clean',
  channelMode: 'Dual Channel (Inbound / Agent)',
  overallRiskScore: 11.6,
  riskTier: 'LOW',
  compoundingMultiplier: 1.0,
  threatVerdict: 'AUTHENTIC EXECUTIVE VOICE • HARMONIC PURITY 98.9%',
  forensicSha256: '4a3b8d910f2c4189acbe110294e82f1288c3a9d9418290f1190bc129841bb022',
  biometric: {
    enrolledId: 'BIO-EXEC-001',
    fullName: 'Marcus Vance',
    title: 'Chief Information Security Officer',
    department: 'Global Security & Resiliency',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    ecapaEmbeddingHash: '0x3c81e991da01824f...192d_centroid',
    centroidSamples: 58,
    enrolledDate: '2025-08-01',
    similarityScore: 0.94,
    matchThreshold: 0.78,
    status: 'VERIFIED_MATCH'
  },
  factors: [
    {
      id: 'f1',
      name: 'Acoustic Synthetic Artifacts',
      category: 'acoustic',
      weight: 0.35,
      rawScore: 8.0,
      weightedScore: 2.8,
      description: 'Continuous phase alignment and organic vocal tract glottal pulse verified across entire spectrum.',
      anomalyDetected: false
    },
    {
      id: 'f2',
      name: 'ECAPA-TDNN Biometric Mismatch',
      category: 'biometric',
      weight: 0.30,
      rawScore: 6.0,
      weightedScore: 1.8,
      description: 'Cosine similarity 0.94 exhibits near-perfect alignment with enrolled CISO baseline model.',
      anomalyDetected: false
    },
    {
      id: 'f3',
      name: 'Social Engineering & Urgent Wording',
      category: 'linguistic',
      weight: 0.20,
      rawScore: 12.0,
      weightedScore: 2.4,
      description: 'Conversational tone conforms to normal quarterly operational review patterns; zero coercion indicators.',
      anomalyDetected: false
    },
    {
      id: 'f4',
      name: 'Telephony Route & CDR Anomalies',
      category: 'telephony',
      weight: 0.10,
      rawScore: 15.0,
      weightedScore: 1.5,
      description: 'Direct enterprise encrypted SIP trunk origin from verified corporate HQ range.',
      anomalyDetected: false
    },
    {
      id: 'f5',
      name: 'Temporal Stress & Cadence Flux',
      category: 'behavioral',
      weight: 0.05,
      rawScore: 14.0,
      weightedScore: 0.7,
      description: 'Natural pitch contour variation and breathing intervals match authentic human physiological baseline.',
      anomalyDetected: false
    }
  ],
  segments: [
    { id: 'seg-1', startTime: 0.0, endTime: 7.2, syntheticScore: 0.08, frequencyArtifacts: false, phaseDiscontinuity: false },
    { id: 'seg-2', startTime: 7.2, endTime: 16.5, syntheticScore: 0.11, frequencyArtifacts: false, phaseDiscontinuity: false },
    { id: 'seg-3', startTime: 16.5, endTime: 24.0, syntheticScore: 0.09, frequencyArtifacts: false, phaseDiscontinuity: false },
    { id: 'seg-4', startTime: 24.0, endTime: 28.5, syntheticScore: 0.07, frequencyArtifacts: false, phaseDiscontinuity: false }
  ],
  transcript: [
    {
      id: 't1',
      timeOffset: 0.5,
      speaker: 'Receiver (Analyst)',
      text: 'Good morning Marcus, TrueVoice security center. How are things looking today?'
    },
    {
      id: 't2',
      timeOffset: 3.8,
      speaker: 'Caller (Target)',
      text: 'Hey Devon. Just reviewing our quarterly failover tests. Everything on cluster 4 completed gracefully yesterday.'
    },
    {
      id: 't3',
      timeOffset: 11.2,
      speaker: 'Receiver (Analyst)',
      text: 'Excellent. The latency telemetry held steady at under 14ms across all US-East nodes.'
    },
    {
      id: 't4',
      timeOffset: 17.6,
      speaker: 'Caller (Target)',
      text: 'Glad to hear it. Let us keep monitoring the load through market open tomorrow and sync up during the Thursday standup.'
    }
  ],
  lockedActions: []
};

export const scenarioBorderline: ForensicCallScenario = {
  id: 'SCN-BORDERLINE-047',
  title: '🟡 Borderline: Codec Degradation & Jitter',
  badgeText: 'CAUTION: STEP-UP REQUIRED',
  type: 'borderline',
  filename: 'call_rec_2026_09_18_satellite_field_call_dc.wav',
  fileSize: '2.9 MB',
  audioDuration: 24.0,
  sampleRate: '8.0 kHz (AMR-NB Narrowband)',
  codec: 'AMR-NB 12.2 kbps (Lossy Transcode)',
  channelMode: 'Single Channel (Inbound)',
  overallRiskScore: 54.2,
  riskTier: 'CAUTION',
  compoundingMultiplier: 1.15,
  threatVerdict: 'SUSPICIOUS TELEPHONY JITTER • STEP-UP OOB CHALLENGE REQUIRED',
  forensicSha256: '9f8372b0129a88c39e145129c991823a010488df1239aa812390fca1029381a4',
  biometric: {
    enrolledId: 'BIO-EXEC-002',
    fullName: 'David Chen',
    title: 'VP Engineering & Infrastructure',
    department: 'Platform Engineering',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    ecapaEmbeddingHash: '0x192a839f...centroid_v2',
    centroidSamples: 36,
    enrolledDate: '2025-09-12',
    similarityScore: 0.81,
    matchThreshold: 0.78,
    status: 'VERIFIED_MATCH'
  },
  factors: [
    {
      id: 'f1',
      name: 'Acoustic Synthetic Artifacts',
      category: 'acoustic',
      weight: 0.35,
      rawScore: 58.0,
      weightedScore: 20.3,
      description: 'High packet loss (12%) and aggressive codec compression induced harmonic truncation mimicking vocoder gaps.',
      anomalyDetected: true
    },
    {
      id: 'f2',
      name: 'ECAPA-TDNN Biometric Mismatch',
      category: 'biometric',
      weight: 0.30,
      rawScore: 32.0,
      weightedScore: 9.6,
      description: 'Cosine similarity 0.81 meets threshold (0.78), but narrowband downsampling lowers confidence margin.',
      anomalyDetected: false
    },
    {
      id: 'f3',
      name: 'Social Engineering & Urgent Wording',
      category: 'linguistic',
      weight: 0.20,
      rawScore: 64.0,
      weightedScore: 12.8,
      description: 'Request to approve emergency off-cycle bastion SSH key injection during transit.',
      anomalyDetected: true
    },
    {
      id: 'f4',
      name: 'Telephony Route & CDR Anomalies',
      category: 'telephony',
      weight: 0.10,
      rawScore: 72.0,
      weightedScore: 7.2,
      description: 'Roaming satellite link routing through transit hub in Zurich; IP origin differs from typical residential carrier.',
      anomalyDetected: true
    },
    {
      id: 'f5',
      name: 'Temporal Stress & Cadence Flux',
      category: 'behavioral',
      weight: 0.05,
      rawScore: 45.0,
      weightedScore: 2.25,
      description: 'Audio frame jitter causes intermittent speech clipping.',
      anomalyDetected: false
    }
  ],
  segments: [
    { id: 'seg-1', startTime: 0.0, endTime: 6.0, syntheticScore: 0.42, frequencyArtifacts: true, phaseDiscontinuity: false },
    { id: 'seg-2', startTime: 6.0, endTime: 15.0, syntheticScore: 0.62, frequencyArtifacts: true, phaseDiscontinuity: true },
    { id: 'seg-3', startTime: 15.0, endTime: 24.0, syntheticScore: 0.38, frequencyArtifacts: false, phaseDiscontinuity: false }
  ],
  transcript: [
    {
      id: 't1',
      timeOffset: 0.5,
      speaker: 'Caller (Target)',
      text: 'Hey team, David here. Calling from the satellite terminal at the data center expansion site.'
    },
    {
      id: 't2',
      timeOffset: 5.8,
      speaker: 'Caller (Target)',
      text: 'The connection is patchy. I need you to push an emergency SSH public key to bastion-01 so our field tech can complete the uplink.',
      threatToken: {
        keyword: 'emergency SSH public key push',
        threatClass: 'SUSPICIOUS_OVERRIDE',
        severity: 'medium'
      }
    },
    {
      id: 't3',
      timeOffset: 12.4,
      speaker: 'Receiver (Analyst)',
      text: 'Hi David, your voice is breaking up. TrueVoice flagged the connection for Step-Up Out-of-Band Push Challenge.'
    },
    {
      id: 't4',
      timeOffset: 18.0,
      speaker: 'Caller (Target)',
      text: 'No problem, send the push to my YubiKey or hardware app now, I will tap it immediately.'
    }
  ],
  lockedActions: [
    {
      id: 'ACT-SSH-4401',
      actionName: 'Emergency Bastion SSH Key Injection (Root)',
      category: 'INFRASTRUCTURE',
      targetResource: 'prod-bastion-us-east.enterprise.internal',
      lockedAt: '13:08:44 UTC',
      status: 'PENDING_CHALLENGE'
    }
  ]
};

export const mockIncidentSessions: IncidentSession[] = [
  {
    id: 'SES-9021',
    callId: 'CALL-20260918-092',
    timestamp: '2026-09-18 14:22:04 UTC',
    callerLabel: 'SIP +1 (415) 890-4102',
    claimedIdentity: 'Sarah Jenkins (CFO)',
    durationFormatted: '00:32',
    riskScore: 88.4,
    riskTier: 'CRITICAL',
    primaryThreatFlag: 'Acoustic Clone + $2.45M Escrow Wire',
    biometricSimilarity: 0.38,
    biometricVerdict: 'MISMATCH',
    actionsBlockedCount: 3,
    forensicHash: 'e3b0c44298fc1c14...b855',
    riskProgression: [
      { time: 0, score: 20 },
      { time: 5, score: 62 },
      { time: 10, score: 86 },
      { time: 18, score: 79 },
      { time: 24, score: 94 },
      { time: 32, score: 88 }
    ]
  },
  {
    id: 'SES-9020',
    callId: 'CALL-20260918-084',
    timestamp: '2026-09-18 13:41:19 UTC',
    callerLabel: 'Inbound WebRTC Direct',
    claimedIdentity: 'Marcus Vance (CISO)',
    durationFormatted: '00:28',
    riskScore: 11.6,
    riskTier: 'LOW',
    primaryThreatFlag: 'Clean Executive Review',
    biometricSimilarity: 0.94,
    biometricVerdict: 'MATCH',
    actionsBlockedCount: 0,
    forensicHash: '4a3b8d910f2c4189...b022',
    riskProgression: [
      { time: 0, score: 10 },
      { time: 8, score: 12 },
      { time: 16, score: 9 },
      { time: 28, score: 11 }
    ]
  },
  {
    id: 'SES-9019',
    callId: 'CALL-20260918-067',
    timestamp: '2026-09-18 12:15:30 UTC',
    callerLabel: 'SIP Trunk (Zurich Gateway)',
    claimedIdentity: 'David Chen (VP Eng)',
    durationFormatted: '00:24',
    riskScore: 54.2,
    riskTier: 'CAUTION',
    primaryThreatFlag: 'AMR-NB Jitter + Bastion Key Injection',
    biometricSimilarity: 0.81,
    biometricVerdict: 'MATCH',
    actionsBlockedCount: 1,
    forensicHash: '9f8372b0129a88c3...81a4',
    riskProgression: [
      { time: 0, score: 25 },
      { time: 6, score: 58 },
      { time: 14, score: 64 },
      { time: 24, score: 54 }
    ]
  },
  {
    id: 'SES-9018',
    callId: 'CALL-20260917-210',
    timestamp: '2026-09-17 19:04:12 UTC',
    callerLabel: 'VoIP Private Trunk #4',
    claimedIdentity: 'Elena Rostova (Lead Forensic)',
    durationFormatted: '01:14',
    riskScore: 72.8,
    riskTier: 'VERIFY',
    primaryThreatFlag: 'Synthesized Whisper Vocoder Mimic',
    biometricSimilarity: 0.52,
    biometricVerdict: 'MISMATCH',
    actionsBlockedCount: 2,
    forensicHash: '1a2b3c4d5e6f7a8b...9c0d',
    riskProgression: [
      { time: 0, score: 30 },
      { time: 20, score: 68 },
      { time: 45, score: 82 },
      { time: 74, score: 72 }
    ]
  },
  {
    id: 'SES-9017',
    callId: 'CALL-20260917-155',
    timestamp: '2026-09-17 14:22:50 UTC',
    callerLabel: 'Teams Gateway Direct',
    claimedIdentity: 'Sarah Jenkins (CFO)',
    durationFormatted: '02:40',
    riskScore: 8.9,
    riskTier: 'LOW',
    primaryThreatFlag: 'Legitimate Board Meeting Update',
    biometricSimilarity: 0.96,
    biometricVerdict: 'MATCH',
    actionsBlockedCount: 0,
    forensicHash: '778899aabbccdde...1122',
    riskProgression: [
      { time: 0, score: 8 },
      { time: 60, score: 10 },
      { time: 120, score: 7 },
      { time: 160, score: 9 }
    ]
  },
  {
    id: 'SES-9016',
    callId: 'CALL-20260916-042',
    timestamp: '2026-09-16 09:12:11 UTC',
    callerLabel: 'SIP Spoofed ID +1 (800) 555-0199',
    claimedIdentity: 'Alexander Hayes (CEO)',
    durationFormatted: '00:45',
    riskScore: 96.1,
    riskTier: 'CRITICAL',
    primaryThreatFlag: 'ElevenLabs Zero-Shot Voice Clone Attack',
    biometricSimilarity: 0.22,
    biometricVerdict: 'MISMATCH',
    actionsBlockedCount: 4,
    forensicHash: 'deadbeefcafe0011...9988',
    riskProgression: [
      { time: 0, score: 45 },
      { time: 10, score: 89 },
      { time: 25, score: 98 },
      { time: 45, score: 96 }
    ]
  }
];

export const mockEnrolledSpeakers: BiometricIdentity[] = [
  {
    enrolledId: 'BIO-EXEC-001',
    fullName: 'Marcus Vance',
    title: 'Chief Information Security Officer',
    department: 'Global Security & Resiliency',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    ecapaEmbeddingHash: '0x3c81e991da01824f2b99182390a1829374618290f1190bc129841bb022',
    centroidSamples: 58,
    enrolledDate: '2025-08-01',
    similarityScore: 0.94,
    matchThreshold: 0.78,
    status: 'VERIFIED_MATCH'
  },
  {
    enrolledId: 'BIO-EXEC-004',
    fullName: 'Sarah Jenkins',
    title: 'Chief Financial Officer',
    department: 'Global Treasury & Finance',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    ecapaEmbeddingHash: '0x8f4d92a17e0c4b22910384719283748291048192847291827491028374',
    centroidSamples: 42,
    enrolledDate: '2025-11-14',
    similarityScore: 0.38,
    matchThreshold: 0.78,
    status: 'IMPERSONATION_MISMATCH'
  },
  {
    enrolledId: 'BIO-EXEC-002',
    fullName: 'David Chen',
    title: 'VP Engineering & Infrastructure',
    department: 'Platform Engineering',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    ecapaEmbeddingHash: '0x192a839f10928374829104819284729182749102837482910481928472',
    centroidSamples: 36,
    enrolledDate: '2025-09-12',
    similarityScore: 0.81,
    matchThreshold: 0.78,
    status: 'VERIFIED_MATCH'
  },
  {
    enrolledId: 'BIO-EXEC-003',
    fullName: 'Alexander Hayes',
    title: 'Chief Executive Officer',
    department: 'Executive Office',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    ecapaEmbeddingHash: '0xaa11928394857182948572910482910482910482910482910482910482',
    centroidSamples: 64,
    enrolledDate: '2025-06-20',
    similarityScore: 0.91,
    matchThreshold: 0.78,
    status: 'VERIFIED_MATCH'
  }
];

export const mockAuditLedger: AuditBlock[] = [
  {
    blockNumber: 4892,
    timestamp: '2026-09-18 14:22:24 UTC',
    eventType: 'ACTION_OVERRIDE',
    callId: 'CALL-20260918-092',
    actor: 'TrueVoice Autonomous Guard Engine',
    details: 'Locked $2,450,000 SWIFT wire and triggered out-of-band challenge due to 88.4% synthetic risk.',
    previousHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    blockHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    verified: true
  },
  {
    blockNumber: 4891,
    timestamp: '2026-09-18 14:22:04 UTC',
    eventType: 'INCIDENT_VERDICT',
    callId: 'CALL-20260918-092',
    actor: 'Forensic Detection Pipeline v2.4',
    details: 'Call classified as CRITICAL (88.4%). ECAPA cosine similarity 0.38 (Mismatch). 2 synthetic bursts detected.',
    previousHash: '7d793037a0760186574b0282f2f435e70d71686e9aa553180c81d649d14cfa24',
    blockHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    verified: true
  },
  {
    blockNumber: 4890,
    timestamp: '2026-09-18 13:41:20 UTC',
    eventType: 'INCIDENT_VERDICT',
    callId: 'CALL-20260918-084',
    actor: 'Forensic Detection Pipeline v2.4',
    details: 'Call classified as LOW (11.6%). Identity Marcus Vance (CISO) verified with 0.94 cosine similarity.',
    previousHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    blockHash: '7d793037a0760186574b0282f2f435e70d71686e9aa553180c81d649d14cfa24',
    verified: true
  },
  {
    blockNumber: 4889,
    timestamp: '2026-09-18 11:00:15 UTC',
    eventType: 'POLICY_CHANGE',
    actor: 'Marcus Vance (CISO)',
    details: 'Tightened ECAPA biometric threshold from 0.75 to 0.78 for Treasury and C-Suite execution roles.',
    previousHash: 'fc8252c8dc55839967c58b9ad755a59b61b082ec371e0ab1486ecd87445f45a2',
    blockHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    verified: true
  },
  {
    blockNumber: 4888,
    timestamp: '2026-09-17 18:30:00 UTC',
    eventType: 'BIOMETRIC_ENROLLMENT',
    actor: 'Elena Rostova (Lead Forensic)',
    details: 'Re-enrolled high-fidelity centroid for Sarah Jenkins (CFO) with 42 clean voice tokens (PCM-16).',
    previousHash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    blockHash: 'fc8252c8dc55839967c58b9ad755a59b61b082ec371e0ab1486ecd87445f45a2',
    verified: true
  },
  {
    blockNumber: 4887,
    timestamp: '2026-09-16 09:12:15 UTC',
    eventType: 'CHALLENGE_ISSUED',
    callId: 'CALL-20260916-042',
    actor: 'TrueVoice Autonomous Guard Engine',
    details: 'Triggered step-up FIDO2 hardware challenge to CEO Alexander Hayes for unauthorized treasury instruction.',
    previousHash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    blockHash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    verified: true
  }
];

export const defaultThreatPolicy: ThreatPolicy = {
  cautionThreshold: 35,
  verifyThreshold: 65,
  blockThreshold: 85,
  ecapaSimilarityThreshold: 0.78,
  syntheticBurstToleranceSec: 0.8,
  highValueWireLockdown: true,
  mfaChallengeAutomatic: true,
  telephonyVpnAnomalyBoost: true
};
