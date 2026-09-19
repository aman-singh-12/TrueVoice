import type { RiskTier, TrustState } from '../types/telemetry';
import { TrustBadge } from './ui/badges';

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
  LOW: '#047857',
  MODERATE: '#b45309',
  HIGH: '#c2410c',
  CRITICAL: '#be123c',
};

export function RiskGauge({ score, tier, trustState, active }: RiskGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const color = TIER_COLOR[tier] || TIER_COLOR.LOW;
  const radius = 90;
  const cx = 120;
  const cy = 115;
  const startAngle = (-200 * Math.PI) / 180;
  const endAngle = (20 * Math.PI) / 180;
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
      className="flex flex-col items-center"
      data-testid="risk-gauge"
      role="progressbar"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Risk score"
    >
      <div className="mb-2 flex w-full items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-mute">Risk score</span>
        <TrustBadge state={trustState} />
      </div>
      <svg viewBox="0 0 240 160" className="w-full max-w-[280px]">
        <path
          d={describeArc(cx, cy, radius, startAngle, endAngle)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {active && clampedScore > 0 ? (
          <path
            d={describeArc(cx, cy, radius, startAngle, Math.max(startAngle + 0.001, currentAngle))}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
          />
        ) : null}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-ink text-[46px] font-semibold">
          {active ? clampedScore : '--'}
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle" className="fill-mute text-sm">
          / 100
        </text>
      </svg>
      <p className="mt-1 text-sm font-semibold" style={{ color: active ? color : '#64748b' }}>
        {TIER_LABEL[tier] || TIER_LABEL.LOW}
      </p>
    </div>
  );
}
