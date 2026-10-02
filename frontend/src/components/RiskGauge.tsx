import type { RiskTier, TrustState } from '../types/telemetry';
import { TrustBadge, RiskBadge } from './ui/badges';

export interface RiskGaugeProps {
  score: number;
  tier: RiskTier;
  trustState: TrustState;
  active: boolean;
}

const TIER_LABEL: Record<RiskTier, string> = {
  LOW: 'LOW RISK',
  MODERATE: 'MODERATE RISK',
  HIGH: 'HIGH RISK',
  CRITICAL: 'CRITICAL RISK',
};

const TIER_COLOR: Record<RiskTier, string> = {
  LOW: '#10b981',
  MODERATE: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

export function RiskGauge({ score, tier, trustState, active }: RiskGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const color = TIER_COLOR[tier] || TIER_COLOR.LOW;
  const radius = 86;
  const cx = 120;
  const cy = 110;
  const startAngle = (-205 * Math.PI) / 180;
  const endAngle = (25 * Math.PI) / 180;
  const totalAngle = endAngle - startAngle;
  const currentAngle = startAngle + (clampedScore / 100) * totalAngle;

  const describeArc = (x: number, y: number, r: number, start: number, end: number) => {
    const startX = x + r * Math.cos(start);
    const startY = y + r * Math.sin(start);
    const endX = x + r * Math.cos(end);
    const endY = y + r * Math.sin(end);
    const largeArcFlag = end - start <= Math.PI ? 0 : 1;
    return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  };

  return (
    <div
      className="flex flex-col items-center justify-between w-full"
      data-testid="risk-gauge"
      role="progressbar"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Risk score"
    >
      <div className="mb-2 flex w-full items-center justify-between">
        <span className="text-xs font-mono font-medium uppercase tracking-wider text-slate-400">
          Risk Assessment
        </span>
        <TrustBadge state={trustState} />
      </div>

      <div className="relative flex items-center justify-center my-2">
        <svg viewBox="0 0 240 150" className="w-full max-w-[280px] drop-shadow-md">
          {/* Base background track */}
          <path
            d={describeArc(cx, cy, radius, startAngle, endAngle)}
            fill="none"
            stroke="#1e293b"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Calibrated Tick Marks */}
          {[0, 25, 50, 75, 100].map((t) => {
            const angle = startAngle + (t / 100) * totalAngle;
            const x1 = cx + (radius - 12) * Math.cos(angle);
            const y1 = cy + (radius - 12) * Math.sin(angle);
            const x2 = cx + (radius - 6) * Math.cos(angle);
            const y2 = cy + (radius - 6) * Math.sin(angle);
            return (
              <line
                key={t}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#334155"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Active progress arc */}
          {active && clampedScore > 0 ? (
            <path
              d={describeArc(cx, cy, radius, startAngle, Math.max(startAngle + 0.001, currentAngle))}
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 8px ${color}80)`,
                transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease',
              }}
            />
          ) : null}

          {/* Centered Large Numeric Score */}
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            className="fill-slate-100 font-mono font-bold tracking-tight text-[48px]"
          >
            {active ? clampedScore : '--'}
          </text>
          <text
            x={cx}
            y={cy + 22}
            textAnchor="middle"
            className="fill-slate-500 font-mono text-xs uppercase tracking-widest"
          >
            / 100 Index
          </text>
        </svg>
      </div>

      <div className="flex flex-col items-center gap-1.5 mt-1">
        <p className="text-sm font-bold font-mono tracking-wider" style={{ color: active ? color : '#64748b' }}>
          {TIER_LABEL[tier] || TIER_LABEL.LOW}
        </p>
        <RiskBadge tier={tier} size="sm" />
      </div>
    </div>
  );
}
