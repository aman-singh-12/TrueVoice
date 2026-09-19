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
  // Gauge geometry:
  // Center at (120, 100), Radius = 76
  // Arc goes from 180° (left) to 360°/0° (right).
  const radius = 76;
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // ≈ 238.76
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Mathematically anchored needle geometry (ZERO CSS transform-origin bugs):
  const angleRad = Math.PI * (1 - score / 100);
  const needleLength = 58;
  const tipX = 120 + needleLength * Math.cos(angleRad);
  const tipY = 100 - needleLength * Math.sin(angleRad);

  const baseWidth = 3;
  const perpAngle = angleRad + Math.PI / 2;
  const baseLeftX = 120 + baseWidth * Math.cos(perpAngle);
  const baseLeftY = 100 - baseWidth * Math.sin(perpAngle);
  const baseRightX = 120 - baseWidth * Math.cos(perpAngle);
  const baseRightY = 100 + baseWidth * Math.sin(perpAngle);

  // Light-mode tuned colors based on score
  const getThemeColor = () => {
    if (score < 30) return '#047857'; // Emerald 700
    if (score < 60) return '#B45309'; // Amber 700
    if (score < 80) return '#C2410C'; // Orange 700
    return '#BE123C'; // Rose 700
  };

  const currentColor = getThemeColor();

  return (
    <div className="bg-white border border-[#EAEAE5] rounded-2xl p-5 shadow-soft flex flex-col h-full justify-between">
      <div>
        {/* Header with Title and Tier Badge */}
        <div className="flex items-center justify-between mb-4 border-b border-[#EAEAE5] pb-3">
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

        {/* Speedometer Gauge Visual Container */}
        <div className="relative flex flex-col items-center justify-center my-1">
          <svg className="w-60 h-32" viewBox="0 0 240 120">
            <defs>
              <linearGradient id="warmGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="35%" stopColor="#F59E0B" />
                <stop offset="70%" stopColor="#EA580C" />
                <stop offset="100%" stopColor="#BE123C" />
              </linearGradient>
            </defs>

            {/* Background Track Arc */}
            <path
              d="M 44,100 A 76,76 0 0,1 196,100"
              fill="none"
              stroke="#EAEAE5"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />

            {/* Value Arc */}
            <path
              d="M 44,100 A 76,76 0 0,1 196,100"
              fill="none"
              stroke="url(#warmGaugeGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />

            {/* Mathematically Anchored Needle Tapered Polygon */}
            <polygon
              points={`${baseLeftX.toFixed(2)},${baseLeftY.toFixed(2)} ${baseRightX.toFixed(2)},${baseRightY.toFixed(2)} ${tipX.toFixed(2)},${tipY.toFixed(2)}`}
              fill={currentColor}
              className="transition-all duration-700 ease-out"
            />

            {/* Center Pivot Bezel */}
            <circle cx="120" cy="100" r="7.5" fill="#FFFFFF" stroke="#EAEAE5" strokeWidth="2" />
            <circle cx="120" cy="100" r="4" fill={currentColor} />

            {/* Scale End Labels */}
            <text x="36" y="116" fill="#A1A1AA" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">0%</text>
            <text x="120" y="15" fill="#A1A1AA" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">50%</text>
            <text x="204" y="116" fill="#A1A1AA" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">100%</text>
          </svg>

          {/* Clean Central Digital Readout (Directly below gauge baseline with clear spacing - ZERO OVERLAP) */}
          <div className="text-center mt-2">
            <div className="flex items-baseline justify-center gap-1.5 font-mono">
              <span className="text-3xl font-extrabold tracking-tight text-[#18181B]">
                {score.toFixed(1)}%
              </span>
              <span className="text-xs text-[#A1A1AA] font-normal">/ 100</span>
            </div>
            <div className="text-[11px] font-mono text-[#71717A] uppercase tracking-widest mt-0.5">
              Composite Impersonation Index
            </div>
          </div>

          {/* Threat Multiplier Badge */}
          {compoundingMultiplier > 1.0 && (
            <div className="mt-2.5 flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] text-[11px] font-mono shadow-soft-sm text-center">
              <svg className="w-3.5 h-3.5 text-[#EA580C] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>
                Threat Boost: <strong>+{((compoundingMultiplier - 1.0) * 100).toFixed(0)}%</strong> Active
              </span>
            </div>
          )}
        </div>

        {/* Primary Threat Verdict Alert */}
        <div className={`mt-3.5 p-3.5 rounded-xl border text-xs font-mono shadow-soft-sm ${
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
      </div>

      {/* 5-Factor Weighted Decomposition */}
      <div className="space-y-2.5 pt-4 mt-4 border-t border-[#EAEAE5]">
        <div className="flex items-center justify-between text-[11px] font-mono text-[#71717A]">
          <span>Decomposed Vector Breakdown</span>
          <span>Weight / Score</span>
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
                    <span className="w-1.5 h-1.5 rounded-full bg-[#BE123C] flex-shrink-0" />
                  )}
                  <span className="truncate max-w-[180px]">{factor.name}</span>
                </span>
                <span className="font-mono text-[11px] text-[#71717A] flex-shrink-0">
                  <span className="text-[#A1A1AA]">{(factor.weight * 100).toFixed(0)}%</span> · <strong className={isHigh ? 'text-[#BE123C]' : isMed ? 'text-[#C2410C]' : 'text-[#047857]'}>{factor.rawScore.toFixed(0)}/100</strong>
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
