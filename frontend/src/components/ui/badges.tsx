import type { RiskTier } from '../../types/index';
import type { RiskTier as TelemetryRiskTier, TrustState } from '../../types/telemetry';
import { cn } from '../../lib/cn';

const RISK: Record<string, { wrap: string; dot: string; label: string }> = {
  LOW: {
    wrap: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300',
    dot: 'bg-emerald-400',
    label: 'Low',
  },
  MODERATE: {
    wrap: 'border-amber-500/30 bg-amber-950/40 text-amber-300',
    dot: 'bg-amber-400',
    label: 'Moderate',
  },
  HIGH: {
    wrap: 'border-orange-500/40 bg-orange-950/50 text-orange-300',
    dot: 'bg-orange-400',
    label: 'High',
  },
  CRITICAL: {
    wrap: 'border-rose-500/50 bg-rose-950/60 text-rose-300 animate-pulse',
    dot: 'bg-rose-400',
    label: 'Critical',
  },
  CAUTION: {
    wrap: 'border-amber-500/30 bg-amber-950/40 text-amber-300',
    dot: 'bg-amber-400',
    label: 'Caution',
  },
  VERIFY: {
    wrap: 'border-orange-500/40 bg-orange-950/50 text-orange-300',
    dot: 'bg-orange-400',
    label: 'Verify',
  },
};

const TRUST: Record<TrustState, { wrap: string; dot: string }> = {
  OBSERVING: {
    wrap: 'border-slate-700 bg-slate-800/60 text-slate-300',
    dot: 'bg-slate-400',
  },
  CAUTION: {
    wrap: 'border-amber-500/30 bg-amber-950/40 text-amber-300',
    dot: 'bg-amber-400',
  },
  VERIFYING: {
    wrap: 'border-sky-500/40 bg-sky-950/50 text-sky-300 animate-pulse',
    dot: 'bg-sky-400',
  },
  TRUSTED: {
    wrap: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  RESTRICTED: {
    wrap: 'border-orange-500/40 bg-orange-950/50 text-orange-300',
    dot: 'bg-orange-400',
  },
  BLOCKED: {
    wrap: 'border-rose-500/50 bg-rose-950/60 text-rose-300',
    dot: 'bg-rose-400',
  },
  HUMAN_REVIEW: {
    wrap: 'border-purple-500/40 bg-purple-950/50 text-purple-300',
    dot: 'bg-purple-400',
  },
  TERMINATED: {
    wrap: 'border-slate-800 bg-slate-900/60 text-slate-500',
    dot: 'bg-slate-600',
  },
};

export function RiskBadge({
  tier,
  size = 'md',
}: {
  tier: RiskTier | TelemetryRiskTier | string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cfg = RISK[tier] || RISK.LOW;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-mono font-medium tracking-wide uppercase',
        size === 'sm' && 'px-2 py-0.5 text-[10px]',
        size === 'md' && 'px-2.5 py-0.5 text-xs',
        size === 'lg' && 'px-3 py-1 text-sm font-semibold',
        cfg.wrap
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} aria-hidden />
      <span className="sr-only">Risk tier: </span>
      {cfg.label}
    </span>
  );
}

export function TrustBadge({ state }: { state: TrustState | string }) {
  const cfg = TRUST[state as TrustState] || TRUST.OBSERVING;
  const label = String(state).replace(/_/g, ' ');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium tracking-wide uppercase',
        cfg.wrap
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} aria-hidden />
      {label}
    </span>
  );
}

export function StatusDot({
  tone,
  label,
  pulse = false,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
  label: string;
  pulse?: boolean;
}) {
  const color = {
    ok: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
    warn: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
    danger: 'bg-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
    neutral: 'bg-slate-500',
  }[tone];

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          color,
          pulse && tone !== 'neutral' && 'animate-ping'
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}
