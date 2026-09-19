import React from 'react';
import { RiskTier, RiskFactor } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface RiskSpeedometerProps {
  score: number; // 0 - 100
  tier: RiskTier;
  compoundingMultiplier: number;
  factors: RiskFactor[];
  verdict: string;
}

export const RiskSpeedometer: React.FC<RiskSpeedometerProps> = ({
  score,
  tier,
  compoundingMultiplier,
  factors,
  verdict,
}) => {
  const radius = 80;
  const strokeWidth = 14;
  const circumference = Math.PI * radius; // Half-circle circumference
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Needle angle: 0 score = -90 deg, 100 score = +90 deg
  const needleAngle = -90 + (score / 100) * 180;

  // Light-mode tuned colors based on score
  const getThemeColor = () => {
    if (score < 30) return '#047857'; // Emerald 700
    if (score < 60) return '#B45309'; // Amber 700
    if (score < 80) return '#C2410C'; // Orange 700
    return '#BE123C'; // Rose 700
  };

  const currentColor = getThemeColor();

  return (
    <div className="bg-white border border-[#EAEAE5] rounded-2xl p-5 shadow-soft flex flex-col h-full">
      {/* Header with Title and Tier Badge */}
      <div className="flex items-center justify-between mb-3 border-b border-[#EAEAE5] pb-3">
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#52525B] font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Forensic Risk Engine
          </h3>
          <p className="text-[11px] text-[#71717A] font-mono mt-0.5">
            Real-Time Composite Threat Scoring
          </p>
        </div>
        <StatusBadge tier={tier} size="md" />
      </div>

      {/* Speedometer Gauge Visual */}
      <div className="relative flex flex-col items-center justify-center my-2">
        <svg className="w-64 h-36 overflow-visible" viewBox="0 0 220 125">
          <defs>
            <linearGradient id="warmGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="45%" stopColor="#F59E0B" />
              <stop offset="75%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#BE123C" />
            </linearGradient>
          </defs>

          {/* Background Track - Soft Sand / Zinc */}
          <path
            d="M 25,110 A 85,85 0 0,1 195,110"
            fill="none"
            stroke="#EAEAE5"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Value Arc */}
          <path
            d="M 25,110 A 85,85 0 0,1 195,110"
            fill="none"
            stroke="url(#warmGaugeGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference * 1.06}
            strokeDashoffset={strokeDashoffset * 1.06}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />

          {/* Needle Pivot & Arm */}
          <g
            transform={`rotate(${needleAngle}, 110, 110)`}
            className="transition-transform duration-700 ease-out origin-[110px_110px]"
          >
            <polygon points="107,110 113,110 111,35 109,35" fill={currentColor} />
            <circle cx="110" cy="110" r="7" fill="#FFFFFF" stroke={currentColor} strokeWidth="3" />
          </g>

          {/* Scale Labels */}
          <text x="22" y="124" fill="#A1A1AA" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">0%</text>
          <text x="110" y="20" fill="#A1A1AA" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">50%</text>
          <text x="198" y="124" fill="#A1A1AA" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">100%</text>
        </svg>

        {/* Center Digital Readout */}
        <div className="text-center -mt-5">
          <div className="flex items-baseline justify-center gap-1 font-mono">
            <span className="text-4xl font-extrabold tracking-tight text-[#18181B]">
              {score.toFixed(1)}%
            </span>
            <span className="text-xs text-[#A1A1AA] font-normal">/100</span>
          </div>
          <div className="text-[11px] font-mono text-[#71717A] uppercase tracking-widest mt-0.5">
            Composite Impersonation Index
          </div>
        </div>

        {/* Compounding Multiplier Badge */}
        {compoundingMultiplier > 1.0 && (
          <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] text-[11px] font-mono shadow-soft-sm">
            <svg className="w-3.5 h-3.5 text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span>Threat Multiplier: <strong>+{((compoundingMultiplier - 1.0) * 100).toFixed(0)}%</strong> (Social Eng + Synthetic Burst)</span>
          </div>
        )}
      </div>

      {/* Primary Threat Verdict Alert */}
      <div className={`mt-2 p-3.5 rounded-xl border text-xs font-mono mb-4 transition-all shadow-soft-sm ${
        score >= 70
          ? 'bg-[#FFF1F2] border-[#FECDD3] text-[#9F1239]'
          : score >= 40
          ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
          : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
      }`}>
        <div className="flex items-center gap-2 font-bold uppercase tracking-wider mb-1">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Forensic Verdict
        </div>
        <p className="text-[11px] leading-relaxed font-sans opacity-95">
          {verdict}
        </p>
      </div>

      {/* 5-Factor Weighted Decomposition */}
      <div className="mt-auto space-y-2.5 pt-2 border-t border-[#EAEAE5]">
        <div className="flex items-center justify-between text-[11px] font-mono text-[#71717A]">
          <span>Decomposed Vector Breakdown</span>
          <span>Weight / Raw Score</span>
        </div>

        {factors.map((factor) => {
          const isHigh = factor.rawScore >= 70;
          const isMed = factor.rawScore >= 40 && factor.rawScore < 70;
          const barColor = isHigh ? 'bg-[#BE123C]' : isMed ? 'bg-[#EA580C]' : 'bg-[#047857]';

          return (
            <div key={factor.id} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#27272A] font-medium truncate flex items-center gap-1.5">
                  {factor.anomalyDetected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#BE123C]" />
                  )}
                  {factor.name}
                </span>
                <span className="font-mono text-[11px] text-[#71717A]">
                  <span className="text-[#A1A1AA]">{(factor.weight * 100).toFixed(0)}% wgt</span> · <strong className={isHigh ? 'text-[#BE123C]' : isMed ? 'text-[#C2410C]' : 'text-[#047857]'}>{factor.rawScore.toFixed(0)}/100</strong>
                </span>
              </div>
              <div className="w-full bg-[#F4F4F0] rounded-full h-1.5 overflow-hidden border border-[#EAEAE5]/60">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-700`}
                  style={{ width: `${factor.rawScore}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
