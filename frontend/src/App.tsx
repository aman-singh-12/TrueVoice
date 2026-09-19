/**
 * TrueVoice Live Security Analyst Operations Console.
 * PERSON 4 - REAL-TIME PLATFORM + FRONTEND
 */

import React, { useState, useEffect } from 'react';
import { useRealtimeSession } from './hooks/useRealtimeSession';
import { api } from './services/api';
import type { TokenResponse } from './types/api';

import { Header } from './components/Header';
import { AudioStreamController } from './components/AudioStreamController';
import { RiskGauge } from './components/RiskGauge';
import { SignalRadar } from './components/SignalRadar';
import { RiskTimeline } from './components/RiskTimeline';
import { ThreatBadges } from './components/ThreatBadges';
import { ChallengeModal } from './components/ChallengeModal';
import { AuditViewer } from './components/AuditViewer';
import { LoginModal } from './components/LoginModal';

import './App.css';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<TokenResponse | null>(api.currentUser);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);

  const {
    session,
    status,
    isMicActive,
    inputVolume,
    latestTelemetry,
    riskHistory,
    trustState,
    riskScore,
    riskTier,
    securityAction,
    networkLatencyMs,
    activeChallenge,
    error,
    startSession,
    stopSession,
    toggleMic,
    dispatchVerification,
    submitVerification,
    applyAnalystOverride,
    clearError,
  } = useRealtimeSession();

  // Prompt login if user is not authenticated on startup
  useEffect(() => {
    if (!api.isAuthenticated) {
      setIsLoginModalOpen(true);
    }
  }, []);

  // Automatically open challenge modal when an active challenge is dispatched
  useEffect(() => {
    if (activeChallenge) {
      setIsChallengeModalOpen(true);
    }
  }, [activeChallenge]);

  const handleLoginSuccess = (auth: TokenResponse) => {
    setCurrentUser(auth);
  };

  const handleLogout = () => {
    if (session) {
      stopSession();
    }
    api.clearAuth();
    setCurrentUser(null);
    setIsLoginModalOpen(true);
  };

  const handleTriggerChallenge = async () => {
    const challenge = await dispatchVerification();
    if (challenge) {
      setIsChallengeModalOpen(true);
    }
  };

  const isStreamActive = status === 'STREAMING' || status === 'CONNECTED';

  return (
    <div className="soc-dashboard-container">
      {/* Top Navigation & Status */}
      <Header
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        streamActive={isStreamActive}
      />

      {/* Global Error Banner */}
      {error && (
        <div className="global-error-banner" role="alert">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
          </div>
          <button
            type="button"
            className="error-dismiss-btn"
            onClick={clearError}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <main className="dashboard-main">
        {/* Session Ingestion & Hardware Control Toolbar */}
        <section className="controller-section">
          <AudioStreamController
            session={session}
            status={status}
            isMicActive={isMicActive}
            inputVolume={inputVolume}
            networkLatencyMs={networkLatencyMs}
            onStartSession={(ani) => {
              if (!api.isAuthenticated) {
                setIsLoginModalOpen(true);
                return;
              }
              startSession(ani);
            }}
            onStopSession={stopSession}
            onToggleMic={toggleMic}
            onTriggerChallenge={handleTriggerChallenge}
            onAnalystOverride={applyAnalystOverride}
            onOpenAuditLedger={() => setIsAuditModalOpen(true)}
          />
        </section>

        {/* Primary Security Telemetry Grid */}
        <section className="dashboard-grid">
          {/* Top Left: Composite Risk Gauge */}
          <div className="grid-cell cell-gauge">
            <RiskGauge
              score={riskScore}
              tier={riskTier}
              trustState={trustState}
              active={isStreamActive}
            />
          </div>

          {/* Top Right: Multi-Signal Fusion Radar */}
          <div className="grid-cell cell-radar">
            <SignalRadar
              breakdown={latestTelemetry ? latestTelemetry.breakdown : null}
              provenance={latestTelemetry ? latestTelemetry.provenance : undefined}
              active={isStreamActive}
            />
          </div>

          {/* Bottom Left: Real-Time Risk Progression Timeline */}
          <div className="grid-cell cell-timeline">
            <RiskTimeline history={riskHistory} active={isStreamActive} />
          </div>

          {/* Bottom Right: Threat Badges & Policy Action */}
          <div className="grid-cell cell-threats">
            <ThreatBadges
              action={securityAction}
              intents={latestTelemetry ? latestTelemetry.detected_intents : []}
              transcript={latestTelemetry ? latestTelemetry.transcript_snippet : null}
              active={isStreamActive}
            />
          </div>
        </section>
      </main>

      {/* Secondary Verification Modal */}
      <ChallengeModal
        challenge={activeChallenge}
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        onSubmitVerification={submitVerification}
      />

      {/* Tamper-Evident SHA-256 Audit Ledger Modal */}
      <AuditViewer
        sessionId={session ? session.id : null}
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />

      {/* Authentication Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          if (api.isAuthenticated) {
            setIsLoginModalOpen(false);
          }
        }}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default App;
