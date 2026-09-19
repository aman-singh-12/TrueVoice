/**
 * TrueVoice Multi-Signal Fusion Radar & Telemetry Breakdown.
 * Visualizes the 5 detection signals: Deepfake, Voice Biometrics, Forensics, Conversation, Context.
 * STRICT: Explicitly marks unavailable signals (e.g. Unenrolled voice) rather than rendering 0.
 */

import React from 'react';
import type { SignalBreakdown, RiskProvenance } from '../types/telemetry';

export interface SignalRadarProps {
  breakdown: SignalBreakdown | null;
  provenance?: RiskProvenance;
  active: boolean;
}

interface SignalItemConfig {
  key: keyof SignalBreakdown;
  label: string;
  description: string;
  defaultModel: string;
}

const SIGNALS: SignalItemConfig[] = [
  {
    key: 'deepfake',
    label: 'SYNTHETIC SPEECH / DEEPFAKE',
    description: 'Neural artifact & phase spoof detection',
    defaultModel: 'Ensemble (Wav2Vec2 + RawNet2)',
  },
  {
    key: 'speaker_similarity',
    label: 'VOICE BIOMETRIC SIMILARITY',
    description: 'Cosine match to enrolled reference voiceprint',
    defaultModel: 'ECAPA-TDNN / Res2Net',
  },
  {
    key: 'forensic_anomaly',
    label: 'FORENSIC ACOUSTIC ANOMALY',
    description: 'Codec mismatch, spectral tilt & replay artifacts',
    defaultModel: 'DSP Acoustic Analyzer',
  },
  {
    key: 'conversational_threat',
    label: 'CONVERSATIONAL THREAT',
    description: 'Social engineering urgency & credential extraction',
    defaultModel: 'FastWhisper + Intent Classifier',
  },
  {
    key: 'context_sensitivity',
    label: 'CONTEXT SENSITIVITY',
    description: 'Target transaction value & operational posture',
    defaultModel: 'Context Risk Matrix',
  },
];

export const SignalRadar: React.FC<SignalRadarProps> = ({
  breakdown,
  provenance,
  active,
}) => {
  return (
    <div className="signal-radar-card" data-testid="signal-radar">
      <div className="card-header">
        <h3 className="card-title">MULTI-SIGNAL FUSION TELEMETRY</h3>
        <span className="card-subtitle">5-Signal Decomposition Pipeline</span>
      </div>

      <div className="signal-list">
        {SIGNALS.map((sig) => {
          const rawValue = breakdown ? breakdown[sig.key] : null;
          const sigProv = provenance ? provenance[sig.key] : undefined;

          // Check if signal is unavailable or un-enrolled
          const isUnavailable =
            rawValue === null ||
            rawValue === undefined ||
            sigProv?.signal_availability === 'UNAVAILABLE';

          // Score as percentage
          const percent = !isUnavailable && rawValue !== null ? Math.round(rawValue * 100) : 0;

          // Determine signal status color
          let barColor = '#3b82f6';
          if (percent >= 70) barColor = '#ef4444';
          else if (percent >= 40) barColor = '#f59e0b';
          else barColor = '#10b981';

          const modelName = sigProv?.model_name || sig.defaultModel;
          const weightApplied =
            sigProv?.weight_applied !== undefined
              ? (sigProv.weight_applied * 100).toFixed(0) + '%'
              : null;

          return (
            <div key={sig.key} className="signal-row" data-testid={`signal-${sig.key}`}>
              <div className="signal-meta">
                <div className="signal-title-group">
                  <span className="signal-name">{sig.label}</span>
                  <span className="signal-model">{modelName}</span>
                </div>
                <div className="signal-value-group">
                  {isUnavailable ? (
                    <span className="signal-badge unavailable">N/A (UNENROLLED)</span>
                  ) : (
                    <>
                      <span className="signal-score" style={{ color: active ? barColor : '#64748b' }}>
                        {active ? `${percent}%` : '--'}
                      </span>
                      {weightApplied && (
                        <span className="signal-weight">wt: {weightApplied}</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="signal-bar-track">
                {!isUnavailable && active ? (
                  <div
                    className="signal-bar-fill"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: barColor,
                      boxShadow: `0 0 8px ${barColor}66`,
                    }}
                  />
                ) : (
                  <div className="signal-bar-empty" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
