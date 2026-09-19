import { useState } from 'react';
import {
  scenarioAttack,
  scenarioAuthentic,
  scenarioBorderline,
  mockIncidentSessions,
  mockEnrolledSpeakers,
  mockAuditLedger,
  defaultThreatPolicy,
  personas,
} from './data/mockScenarios';
import {
  ForensicCallScenario,
  IncidentSession,
  BiometricIdentity,
  AuditBlock,
  ThreatPolicy,
  UserPersona,
} from './types';
import { Header } from './components/common/Header';
import { ForensicsConsoleView } from './components/views/ForensicsConsoleView';
import { IncidentSessionsView } from './components/views/IncidentSessionsView';
import { VoiceBiometricsVaultView } from './components/views/VoiceBiometricsVaultView';
import { AuditLedgerView } from './components/views/AuditLedgerView';
import { PolicyTuningView } from './components/views/PolicyTuningView';
import { AuthModal } from './components/views/AuthModal';

export function App() {
  const [activeTab, setActiveTab] = useState<
    'console' | 'sessions' | 'speakers' | 'audit' | 'policies'
  >('console');

  const [activeScenarioId, setActiveScenarioId] = useState<string>('attack');
  const [currentScenario, setCurrentScenario] = useState<ForensicCallScenario>(scenarioAttack);

  const [currentPersona, setCurrentPersona] = useState<UserPersona>(personas[0]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const [sessions] = useState<IncidentSession[]>(mockIncidentSessions);
  const [speakers, setSpeakers] = useState<BiometricIdentity[]>(mockEnrolledSpeakers);
  const [auditBlocks, setAuditBlocks] = useState<AuditBlock[]>(mockAuditLedger);
  const [policy, setPolicy] = useState<ThreatPolicy>(defaultThreatPolicy);

  // Scenario Switcher Handler
  const handleSelectScenario = (id: string) => {
    setActiveScenarioId(id);
    if (id === 'attack') {
      setCurrentScenario(scenarioAttack);
    } else if (id === 'authentic') {
      setCurrentScenario(scenarioAuthentic);
    } else if (id === 'borderline') {
      setCurrentScenario(scenarioBorderline);
    }
  };

  // Inspect Session from Table -> Forensics Console
  const handleInspectSession = (session: IncidentSession) => {
    if (session.callId.includes('092') || session.riskTier === 'CRITICAL') {
      setCurrentScenario(scenarioAttack);
      setActiveScenarioId('attack');
    } else if (session.riskTier === 'LOW') {
      setCurrentScenario(scenarioAuthentic);
      setActiveScenarioId('authentic');
    } else {
      setCurrentScenario(scenarioBorderline);
      setActiveScenarioId('borderline');
    }
    setActiveTab('console');
  };

  // Ingestion of user-uploaded file simulation
  const handleFileUpload = (file: File) => {
    const isWav = file.name.endsWith('.wav');
    const newScenario: ForensicCallScenario = {
      id: `SCN-CUSTOM-${Date.now()}`,
      title: `⚡ Ingested Audio: ${file.name}`,
      badgeText: 'FORENSIC INGESTION COMPLETE',
      type: 'borderline',
      filename: file.name,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      audioDuration: 30.0,
      sampleRate: isWav ? '16.0 kHz (PCM-16)' : '44.1 kHz (Compressed)',
      codec: file.type || 'Audio Binary Stream',
      channelMode: 'Dual Channel (Stereo Ingest)',
      overallRiskScore: 68.2,
      riskTier: 'VERIFY',
      compoundingMultiplier: 1.25,
      threatVerdict: 'VOCAL SYNTHESIS DETECTED ON CHANNEL 1 • REQUIRING SECONDARY CONFIRMATION',
      forensicSha256: Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join(''),
      biometric: speakers[0] || scenarioAttack.biometric,
      factors: [
        {
          id: 'f1',
          name: 'Acoustic Synthetic Artifacts',
          category: 'acoustic',
          weight: 0.35,
          rawScore: 72.0,
          weightedScore: 25.2,
          description: `Extracted from uploaded ${file.name}; phase discontinuities identified across vocal tract frequency envelope.`,
          anomalyDetected: true,
        },
        {
          id: 'f2',
          name: 'ECAPA-TDNN Biometric Mismatch',
          category: 'biometric',
          weight: 0.3,
          rawScore: 65.0,
          weightedScore: 19.5,
          description: 'Cosine similarity against closest authorized executive centroid is 0.62 (Threshold 0.78).',
          anomalyDetected: true,
        },
        {
          id: 'f3',
          name: 'Social Engineering & Urgent Wording',
          category: 'linguistic',
          weight: 0.2,
          rawScore: 58.0,
          weightedScore: 11.6,
          description: 'Awaiting secondary full Whisper ASR tokenization.',
          anomalyDetected: false,
        },
        {
          id: 'f4',
          name: 'Telephony Route & CDR Anomalies',
          category: 'telephony',
          weight: 0.1,
          rawScore: 40.0,
          weightedScore: 4.0,
          description: 'Local file container ingestion; direct media stream.',
          anomalyDetected: false,
        },
        {
          id: 'f5',
          name: 'Temporal Stress & Cadence Flux',
          category: 'behavioral',
          weight: 0.05,
          rawScore: 52.0,
          weightedScore: 2.6,
          description: 'Prosody rhythm fluctuation detected.',
          anomalyDetected: false,
        },
      ],
      segments: [
        { id: 'seg-1', startTime: 0.0, endTime: 8.0, syntheticScore: 0.2, frequencyArtifacts: false, phaseDiscontinuity: false },
        { id: 'seg-2', startTime: 8.0, endTime: 20.0, syntheticScore: 0.84, frequencyArtifacts: true, phaseDiscontinuity: true },
        { id: 'seg-3', startTime: 20.0, endTime: 30.0, syntheticScore: 0.35, frequencyArtifacts: false, phaseDiscontinuity: false },
      ],
      transcript: [
        {
          id: 't-up-1',
          timeOffset: 1.0,
          speaker: 'Caller (Target)',
          text: `[Audio Stream Ingested: ${file.name}] Verification of acoustic signature underway.`,
        },
        {
          id: 't-up-2',
          timeOffset: 9.2,
          speaker: 'Caller (Target)',
          text: 'Security system flagged high anomaly score during synthetic waveform analysis window.',
          threatToken: {
            keyword: 'synthetic waveform analysis window',
            threatClass: 'SUSPICIOUS_OVERRIDE',
            severity: 'medium',
          },
        },
      ],
      lockedActions: [
        {
          id: `ACT-FILE-${Date.now()}`,
          actionName: 'Ingested Media Authorization Release',
          category: 'INFRASTRUCTURE',
          targetResource: file.name,
          lockedAt: 'Just Now',
          status: 'PENDING_CHALLENGE',
        },
      ],
    };

    setCurrentScenario(newScenario);
    setActiveScenarioId('custom');

    // Add to audit ledger
    const newAudit: AuditBlock = {
      blockNumber: auditBlocks[0].blockNumber + 1,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      eventType: 'INCIDENT_VERDICT',
      callId: `CALL-${Date.now().toString().slice(-6)}`,
      actor: currentPersona.name,
      details: `User uploaded '${file.name}' (${newScenario.fileSize}) for forensic analysis. Result: VERIFY (68.2%).`,
      previousHash: auditBlocks[0].blockHash,
      blockHash: newScenario.forensicSha256,
      verified: true,
    };
    setAuditBlocks([newAudit, ...auditBlocks]);
  };

  // Add new speaker
  const handleAddSpeaker = (speaker: BiometricIdentity) => {
    setSpeakers([speaker, ...speakers]);
    const newAudit: AuditBlock = {
      blockNumber: auditBlocks[0].blockNumber + 1,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      eventType: 'BIOMETRIC_ENROLLMENT',
      actor: currentPersona.name,
      details: `Enrolled new biometric profile for ${speaker.fullName} (${speaker.title}) into ECAPA-TDNN vault.`,
      previousHash: auditBlocks[0].blockHash,
      blockHash: speaker.ecapaEmbeddingHash.slice(0, 64),
      verified: true,
    };
    setAuditBlocks([newAudit, ...auditBlocks]);
  };

  // Save policy
  const handleSavePolicy = (newPolicy: ThreatPolicy) => {
    setPolicy(newPolicy);
    const newAudit: AuditBlock = {
      blockNumber: auditBlocks[0].blockNumber + 1,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      eventType: 'POLICY_CHANGE',
      actor: currentPersona.name,
      details: `Threat thresholds updated: Caution=${newPolicy.cautionThreshold}%, Verify=${newPolicy.verifyThreshold}%, Block=${newPolicy.blockThreshold}%, ECAPA Cosine=${newPolicy.ecapaSimilarityThreshold}.`,
      previousHash: auditBlocks[0].blockHash,
      blockHash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      verified: true,
    };
    setAuditBlocks([newAudit, ...auditBlocks]);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#18181B] flex flex-col bg-warm-radial">
      {/* Header with Navigation and Persona */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        currentPersona={currentPersona}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        activeScenarioId={activeScenarioId}
        onSelectScenario={handleSelectScenario}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 md:p-6">
        {activeTab === 'console' && (
          <ForensicsConsoleView
            currentScenario={currentScenario}
            onSelectScenario={handleSelectScenario}
            onFileUpload={handleFileUpload}
          />
        )}

        {activeTab === 'sessions' && (
          <IncidentSessionsView
            sessions={sessions}
            onSelectSessionToInspect={handleInspectSession}
          />
        )}

        {activeTab === 'speakers' && (
          <VoiceBiometricsVaultView
            speakers={speakers}
            onAddSpeaker={handleAddSpeaker}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLedgerView auditBlocks={auditBlocks} />
        )}

        {activeTab === 'policies' && (
          <PolicyTuningView
            initialPolicy={policy}
            onSavePolicy={handleSavePolicy}
          />
        )}
      </main>

      {/* Auth & Persona Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        personas={personas}
        currentPersona={currentPersona}
        onSelectPersona={(persona) => setCurrentPersona(persona)}
      />

      {/* Persistent Enterprise Footer */}
      <footer className="border-t border-[#EAEAE5] bg-white/80 py-4 px-6 text-center text-xs font-mono text-[#71717A] shadow-soft-sm">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TrueVoice Threat Response Console • Zero-Trust Forensic Enclave</span>
          <span>Encrypted Cluster Node: US-East-1A • All Audit Records Cryptographically Chained</span>
        </div>
      </footer>
    </div>
  );
}
export default App;
