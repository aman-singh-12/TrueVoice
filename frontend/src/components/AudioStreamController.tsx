/**
 * TrueVoice Real-Time Audio Streaming Controller & SOC Toolbar.
 * Provides controls for Session Start/Terminate, Mic Capture, VU-Meter,
 * OOB Challenge Trigger, and Analyst Overrides.
 */

import React, { useState } from 'react';
import type { StreamConnectionStatus } from '../services/TrueVoiceStreamClient';
import type { SessionResponse } from '../types/api';

export interface AudioStreamControllerProps {
  session: SessionResponse | null;
  status: StreamConnectionStatus;
  isMicActive: boolean;
  inputVolume: number;
  networkLatencyMs: number;
  onStartSession: (callerAni: string) => void;
  onStopSession: () => void;
  onToggleMic: () => void;
  onTriggerChallenge: () => void;
  onAnalystOverride: (
    action: 'ANALYST_APPROVE' | 'ANALYST_RESTRICT' | 'ANALYST_BLOCK',
    reason: string
  ) => void;
  onOpenAuditLedger: () => void;
}

export const AudioStreamController: React.FC<AudioStreamControllerProps> = ({
  session,
  status,
  isMicActive,
  inputVolume,
  networkLatencyMs,
  onStartSession,
  onStopSession,
  onToggleMic,
  onTriggerChallenge,
  onAnalystOverride,
  onOpenAuditLedger,
}) => {
  const [callerAni, setCallerAni] = useState('+1-800-555-0199');
  const [showOverrideMenu, setShowOverrideMenu] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const isStreaming = status === 'STREAMING' || status === 'CONNECTED';

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (callerAni.trim()) {
      onStartSession(callerAni.trim());
    }
  };

  const handleOverride = (action: 'ANALYST_APPROVE' | 'ANALYST_RESTRICT' | 'ANALYST_BLOCK') => {
    const reason = overrideReason.trim() || `Manual analyst override to ${action}`;
    onAnalystOverride(action, reason);
    setShowOverrideMenu(false);
    setOverrideReason('');
  };

  // Convert volume (0.0 - 1.0) into VU meter bars count (0-12)
  const barCount = 12;
  const activeBars = Math.round(inputVolume * barCount);

  return (
    <div className="stream-controller-card" data-testid="stream-controller">
      <div className="controller-row main-row">
        {/* Session Ingestion Controls */}
        {!session ? (
          <form onSubmit={handleStart} className="start-session-form">
            <div className="input-with-label">
              <label htmlFor="caller-ani" className="control-label">
                CALLER ANI / ID:
              </label>
              <input
                id="caller-ani"
                type="text"
                className="text-input session-ani-input"
                value={callerAni}
                onChange={(e) => setCallerAni(e.target.value)}
                placeholder="+1-800-555-0199"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary start-btn"
              disabled={status === 'CONNECTING'}
            >
              {status === 'CONNECTING' ? '⏳ Connecting...' : '▶ Start Session & Mic'}
            </button>
          </form>
        ) : (
          <div className="active-session-bar">
            <div className="session-info">
              <span className="info-label">ACTIVE SESSION:</span>
              <code className="session-id-text">{session.id.slice(0, 13)}...</code>
              <span className="ani-tag">ANI: {session.caller_ani}</span>
            </div>

            <div className="session-actions">
              <button
                type="button"
                className={`btn btn-icon ${isMicActive ? 'btn-mic-active' : 'btn-mic-muted'}`}
                onClick={onToggleMic}
                title={isMicActive ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {isMicActive ? '🎤 Mic Active' : '🔇 Mic Muted'}
              </button>

              <button
                type="button"
                className="btn btn-warning"
                onClick={onTriggerChallenge}
                title="Dispatch secondary verification challenge"
              >
                🔐 Dispatch Challenge
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={onOpenAuditLedger}
                title="View cryptographic SHA-256 audit ledger"
              >
                ⛓️ Audit Ledger
              </button>

              <div className="override-dropdown-wrapper">
                <button
                  type="button"
                  className="btn btn-override"
                  onClick={() => setShowOverrideMenu(!showOverrideMenu)}
                >
                  ⚖️ Analyst Override ▾
                </button>

                {showOverrideMenu && (
                  <div className="override-menu">
                    <span className="override-menu-title">Analyst Manual Override:</span>
                    <input
                      type="text"
                      className="text-input override-reason-input"
                      placeholder="Reason for override..."
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                    />
                    <div className="override-button-group">
                      <button
                        type="button"
                        className="btn btn-success-sm"
                        onClick={() => handleOverride('ANALYST_APPROVE')}
                      >
                        ✓ Approve (Trusted)
                      </button>
                      <button
                        type="button"
                        className="btn btn-warning-sm"
                        onClick={() => handleOverride('ANALYST_RESTRICT')}
                      >
                        ⚠ Restrict
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-sm"
                        onClick={() => handleOverride('ANALYST_BLOCK')}
                      >
                        ✕ Block
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn btn-danger"
                onClick={onStopSession}
              >
                ⏹ Terminate Session
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audio Activity VU Meter & Stream Health */}
      <div className="controller-row telemetry-row">
        <div className="vu-meter-group">
          <span className="meter-label">MIC INPUT ACTIVITY:</span>
          <div className="vu-bars" title={`Level: ${(inputVolume * 100).toFixed(0)}%`}>
            {Array.from({ length: barCount }).map((_, i) => {
              const active = isMicActive && i < activeBars;
              const isHigh = i >= barCount - 3;
              const isMedium = i >= barCount - 6;
              let barColor = '#10b981';
              if (isHigh) barColor = '#ef4444';
              else if (isMedium) barColor = '#f59e0b';

              return (
                <div
                  key={i}
                  className={`vu-bar ${active ? 'active' : ''}`}
                  style={{
                    backgroundColor: active ? barColor : '#1f2937',
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="stream-diagnostics">
          <span className="diag-item">
            Status:{' '}
            <strong className={`status-tag status-${status.toLowerCase()}`}>
              {status}
            </strong>
          </span>
          {networkLatencyMs > 0 && isStreaming && (
            <span className="diag-item">
              RTT: <strong>{networkLatencyMs} ms</strong>
            </span>
          )}
          <span className="diag-item">
            Audio Stream: <strong>16kHz Linear PCM16-LE Mono</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
