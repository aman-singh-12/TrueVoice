import type { RiskTier } from '../../types/index';
import type { RiskTier as TelemetryRiskTier, TrustState } from '../../types/telemetry';
import { cn } from '../../lib/cn';

const RISK: Record<string, { wrap: string; label: string }> = {
  LOW: { wrap: 'bg-emerald-50 text-low border-emerald-200', label: 'Low' },
  MODERATE: { wrap: 'bg-amber-50 text-mod border-amber-200', label: 'Moderate' },
  HIGH: { wrap: 'bg-orange-50 text-high border-orange-200', label: 'High' },
  CRITICAL: { wrap: 'bg-rose-50 text-crit border-rose-200', label: 'Critical' },
  CAUTION: { wrap: 'bg-amber-50 text-mod border-amber-200', label: 'Caution' },
  VERIFY: { wrap: 'bg-orange-50 text-high border-orange-200', label: 'Verify' },
};

const TRUST: Record<TrustState, string> = {
  OBSERVING: 'bg-slate-100 text-slate-700 border-slate-200',
  CAUTION: 'bg-amber-50 text-mod border-amber-200',
  VERIFYING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  TRUSTED: 'bg-emerald-50 text-low border-emerald-200',
  RESTRICTED: 'bg-orange-50 text-high border-orange-200',
  BLOCKED: 'bg-rose-50 text-crit border-rose-200',
  HUMAN_REVIEW: 'bg-amber-50 text-mod border-amber-200',
  TERMINATED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function RiskBadge({
  tier,
  size = 'md',
}: {
  tier: RiskTier | TelemetryRiskTier | string;
  size?: 'sm' | 'md';
}) {
  const cfg = RISK[tier] || RISK.LOW;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs',
        cfg.wrap
      )}
    >
      <span className="sr-only">Risk tier</span>
      {cfg.label}
    </span>
  );
}

export function TrustBadge({ state }: { state: TrustState | string }) {
  const cls = TRUST[state as TrustState] || TRUST.OBSERVING;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', cls)}>
      {String(state).replace(/_/g, ' ')}
    </span>
  );
}

export function StatusDot({
  tone,
  label,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
  label: string;
}) {
  const color = {
    ok: 'bg-low',
    warn: 'bg-mod',
    danger: 'bg-crit',
    neutral: 'bg-slate-400',
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-mute">
      <span className={cn('h-1.5 w-1.5 rounded-full', color)} aria-hidden />
      {label}
    </span>
  );
}
