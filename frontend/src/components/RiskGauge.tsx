/**
 * TrueVoice Risk Gauge Component.
 * Visualizes composite risk score (0-100) using a precision SVG arc gauge and risk tier pill.
 */

import React from 'react';
import type { RiskTier, TrustState } from '../types/telemetry';

export interface RiskGaugeProps {
  score: number; // 0 to 100
  tier: RiskTier;
  trustState: TrustState;
  active: boolean;
}

const TIER_COLORS: Record<RiskTier, { stroke: string; bg: string; text: string; label: string }> = {
  LOW: {
    stroke: '#10b981', // Emerald
    bg: 'rgba(16, 185, 129, 0.15)',
    text: '#34d399',
    label: 'LOW RISK',
  },
  MODERATE: {
    stroke: '#f59e0b', // Amber
    bg: 'rgba(245, 158, 11, 0.15)',
    text: '#fbbf24',
    label: 'MODERATE RISK',
  },
  HIGH: {
    stroke: '#f97316', // Orange
    bg: 'rgba(249, 115, 22, 0.15)',
    text: '#fb923c',
    label: 'HIGH RISK',
  },
  CRITICAL: {
    stroke: '#ef4444', // Crimson
    bg: 'rgba(239, 68, 68, 0.2)',
    text: '#f87171',
    label: 'CRITICAL RISK',
  },
};

const TRUST_STATE_STYLES: Record<TrustState, { bg: string; text: string; border: string }> = {
  OBSERVING: { bg: '#1e293b', text: '#94a3b8', border: '#475569' },
  CAUTION: { bg: '#451a03', text: '#fbbf24', border: '#b45309' },
  VERIFYING: { bg: '#1e1b4b', text: '#818cf8', border: '#4f46e5' },
  TRUSTED: { bg: '#064e3b', text: '#34d399', border: '#059669' },
  RESTRICTED: { bg: '#4c1d95', text: '#c084fc', border: '#7c3aed' },
  BLOCKED: { bg: '#7f1d1d', text: '#fca5a5', border: '#dc2626' },
  HUMAN_REVIEW: { bg: '#78350f', text: '#fcd34d', border: '#d97706' },
  TERMINATED: { bg: '#0f172a', text: '#64748b', border: '#334155' },
};

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  score,
  tier,
  trustState,
  active,
}) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const tierConfig = TIER_COLORS[tier] || TIER_COLORS.LOW;
  const trustStyle = TRUST_STATE_STYLES[trustState] || TRUST_STATE_STYLES.OBSERVING;

  // Arc math: 220 degree semi-circle arc
  // Radius: 90, Center: (120, 115)
  const radius = 90;
  const cx = 120;
  const cy = 115;
  const startAngle = -200 * (Math.PI / 180);
  const endAngle = 20 * (Math.PI / 180);
  const totalAngle = endAngle - startAngle;

  const currentAngle = startAngle + (clampedScore / 100) * totalAngle;

  // Calculate arc path coordinates
  const describeArc = (x: number, y: number, r: number, start: number, end: number) => {
    const startX = x + r * Math.cos(start);
    const startY = y + r * Math.sin(start);
    const endX = x + r * Math.cos(end);
    const endY = y + r * Math.sin(end);
    const largeArcFlag = end - start <= Math.PI ? 0 : 1;
    return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  };

  const backgroundPath = describeArc(cx, cy, radius, startAngle, endAngle);
  const valuePath = describeArc(cx, cy, radius, startAngle, Math.max(startAngle + 0.001, currentAngle));

  return (
    <div
      className="risk-gauge-card"
      data-testid="risk-gauge"
      role="progressbar"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="gauge-header">
        <span className="card-label">COMPOSITE RISK INDEX</span>
        <span
          className="trust-pill"
          style={{
            backgroundColor: trustStyle.bg,
            color: trustStyle.text,
            borderColor: trustStyle.border,
          }}
        >
          {trustState}
        </span>
      </div>

      <div className="gauge-svg-wrapper">
        <svg viewBox="0 0 240 160" className="gauge-svg">
          {/* Background Track */}
          <path
            d={backgroundPath}
            fill="none"
            stroke="#1f2937"
            strokeWidth="16"
            strokeLinecap="round"
          />

          {/* Active Risk Track */}
          {active && clampedScore > 0 && (
            <path
              d={valuePath}
              fill="none"
              stroke={tierConfig.stroke}
              strokeWidth="16"
              strokeLinecap="round"
              style={{
                transition: 'stroke 0.3s ease, stroke-dashoffset 0.3s ease',
                filter: `drop-shadow(0 0 8px ${tierConfig.stroke}88)`,
              }}
            />
          )}

          {/* Center Value */}
          <text
            x={cx}
            y={cy - 5}
            textAnchor="middle"
            className="gauge-score-value"
            fill={active ? tierConfig.text : '#64748b'}
          >
            {active ? clampedScore : '--'}
          </text>
          <text
            x={cx}
            y={cy + 18}
            textAnchor="middle"
            className="gauge-score-sub"
            fill="#64748b"
          >
            / 100
          </text>
        </svg>
      </div>

      <div className="gauge-footer">
        <div
          className="risk-tier-badge"
          style={{
            backgroundColor: tierConfig.bg,
            color: tierConfig.text,
            borderColor: tierConfig.stroke,
          }}
        >
          <span
            className="tier-dot"
            style={{ backgroundColor: tierConfig.stroke }}
          />
          {tierConfig.label}
        </div>
      </div>
    </div>
  );
};
