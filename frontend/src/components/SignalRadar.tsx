import type { SignalBreakdown, RiskProvenance } from '../types/telemetry';

export interface SignalRadarProps {
  breakdown: SignalBreakdown | null;
  provenance?: RiskProvenance;
  active: boolean;
}

const SIGNALS: { key: keyof SignalBreakdown; label: string; hint: string }[] = [
  { key: 'deepfake', label: 'Deepfake', hint: 'Synthetic speech likelihood' },
  { key: 'speaker_similarity', label: 'Speaker', hint: 'Match to enrolled voiceprint' },
  { key: 'forensic_anomaly', label: 'Forensics', hint: 'Acoustic anomaly' },
  { key: 'conversational_threat', label: 'Conversation', hint: 'Social-engineering intent' },
  { key: 'context_sensitivity', label: 'Context', hint: 'Operational sensitivity' },
];

export function SignalRadar({ breakdown, provenance, active }: SignalRadarProps) {
  return (
    <div data-testid="signal-radar">
      <div className="space-y-3">
        {SIGNALS.map((sig) => {
          const rawValue = breakdown ? breakdown[sig.key] : null;
          const sigProv = provenance ? provenance[sig.key] : undefined;
          const isUnavailable =
            rawValue === null ||
            rawValue === undefined ||
            sigProv?.signal_availability === 'UNAVAILABLE';
          const percent = !isUnavailable && rawValue !== null ? Math.round(Number(rawValue) * 100) : null;
          const modelName = sigProv?.model_name;

          return (
            <div key={sig.key} data-testid={`signal-${sig.key}`}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <div>
                  <span className="text-sm font-medium text-ink">{sig.label}</span>
                  <span className="ml-2 text-xs text-mute">{modelName || sig.hint}</span>
                </div>
                {isUnavailable ? (
                  <span className="text-xs font-medium text-mute">Unavailable</span>
                ) : (
                  <span className="tabular-nums text-sm font-semibold">
                    {active && percent !== null ? `${percent}%` : '--'}
                  </span>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                {!isUnavailable && active && percent !== null ? (
                  <div
                    className="h-full rounded-full bg-slate-700"
                    style={{ width: `${percent}%` }}
                  />
                ) : (
                  <div className="h-full w-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
