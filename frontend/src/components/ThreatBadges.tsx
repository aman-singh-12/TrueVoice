/**
 * TrueVoice Threat Badges & Policy Action Display.
 * Visualizes active declarative policy actions, conversational intent markers, and ASR transcripts.
 */

import React from 'react';
import type { SecurityActionType } from '../types/telemetry';

export interface ThreatBadgesProps {
  action: SecurityActionType;
  intents: string[];
  transcript: string | null;
  active: boolean;
}

const ACTION_CONFIG: Record<
  SecurityActionType,
  { label: string; bg: string; text: string; border: string; desc: string }
> = {
  ALLOW: {
    label: 'ALLOW INTERACTION',
    bg: '#064e3b',
    text: '#34d399',
    border: '#059669',
    desc: 'Risk profile normal. Voice interaction permitted without friction.',
  },
  WARN: {
    label: 'ADVISORY WARNING',
    bg: '#451a03',
    text: '#fbbf24',
    border: '#b45309',
    desc: 'Moderate risk anomaly detected. Operator alert triggered.',
  },
  REQUEST_VERIFICATION: {
    label: 'SECONDARY VERIFICATION REQUIRED',
    bg: '#311042',
    text: '#c084fc',
    border: '#9333ea',
    desc: 'High risk or anomaly detected. Cryptographic out-of-band verification challenge dispatched.',
  },
  RESTRICT: {
    label: 'RESTRICT PRIVILEGES',
    bg: '#4c1d95',
    text: '#e9d5ff',
    border: '#7c3aed',
    desc: 'Sensitive transactions and destructive actions temporarily locked.',
  },
  BLOCK: {
    label: 'IMMEDIATE TERMINATION / BLOCK',
    bg: '#7f1d1d',
    text: '#fca5a5',
    border: '#ef4444',
    desc: 'Critical synthetic voice or impersonation attack detected. Stream blocked.',
  },
  HUMAN_REVIEW: {
    label: 'ESCALATED TO SOC ANALYST',
    bg: '#78350f',
    text: '#fde68a',
    border: '#d97706',
    desc: 'Borderline or contested indicators queued for forensic human assessment.',
  },
};

export const ThreatBadges: React.FC<ThreatBadgesProps> = ({
  action,
  intents,
  transcript,
  active,
}) => {
  const currentAction = ACTION_CONFIG[action] || ACTION_CONFIG.ALLOW;

  return (
    <div className="threat-badges-card" data-testid="threat-badges">
      <div className="card-header">
        <h3 className="card-title">POLICY ENFORCEMENT & INTENT ANALYSIS</h3>
        <span className="card-subtitle">Zero-Trust Rules Engine</span>
      </div>

      <div className="action-banner-container">
        <div
          className="policy-action-banner"
          style={{
            backgroundColor: active ? currentAction.bg : '#1e293b',
            color: active ? currentAction.text : '#64748b',
            borderColor: active ? currentAction.border : '#334155',
          }}
        >
          <div className="action-title-row">
            <span className="action-shield">🛡️</span>
            <span className="action-name">{active ? currentAction.label : 'INACTIVE'}</span>
          </div>
          <p className="action-desc">
            {active ? currentAction.desc : 'No voice interaction currently in progress.'}
          </p>
        </div>
      </div>

      <div className="threat-content-grid">
        {/* Detected Intents */}
        <div className="intent-box">
          <span className="section-label">DETECTED SOCIAL ENGINEERING INTENTS</span>
          <div className="intent-chips">
            {intents && intents.length > 0 ? (
              intents.map((intent, idx) => (
                <span key={idx} className="intent-chip">
                  ⚠️ {intent}
                </span>
              ))
            ) : (
              <span className="no-intents-text">
                {active ? 'No malicious conversational patterns detected' : 'Awaiting audio...'}
              </span>
            )}
          </div>
        </div>

        {/* Live Transcript Snippet */}
        <div className="transcript-box">
          <span className="section-label">LIVE TRANSCRIPT SNIPPET</span>
          <div className="transcript-content">
            {transcript ? (
              <p className="transcript-text">"{transcript}"</p>
            ) : (
              <p className="transcript-placeholder">
                {active ? 'Transcribing speaker utterance...' : 'Speech-to-text idle'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
