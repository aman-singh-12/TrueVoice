import type { SignalBreakdown, RiskProvenance } from '../types/telemetry';

export interface SignalRadarProps {
  breakdown: SignalBreakdown | null;
  provenance?: RiskProvenance;
  active: boolean;
}

interface SignalDef {
  key: keyof SignalBreakdown;
  label: string;
  defaultModel: string;
  description: string;
}

const SIGNALS: SignalDef[] = [
  {
    key: 'deepfake',
    label: 'Deepfake Probability',
    defaultModel: 'RawNet2 / Wav2Vec2 Ensemble',
    description: 'Acoustic artifact & spectral phase anomaly detection',
  },
  {
    key: 'speaker_similarity',
    label: 'Speaker Verification',
    defaultModel: 'ECAPA-TDNN Voiceprint',
    description: 'Cosine similarity to authorized enrolled biometric profile',
  },
  {
    key: 'forensic_anomaly',
    label: 'Forensics & Environment',
    defaultModel: 'DSP Spectral Flux Analysis',
    description: 'Background noise consistency & synthetic silence patterns',
  },
  {
    key: 'conversational_threat',
    label: 'Conversational Threat',
    defaultModel: 'Whisper + NLP Threat Intent',
    description: 'Social engineering keywords (OTP, Wire, Impersonation)',
  },
  {
    key: 'context_sensitivity',
    label: 'Context Sensitivity',
    defaultModel: 'Policy Context Engine',
    description: 'Transaction value & high-risk action flags',
  },
];

export function SignalRadar({ breakdown, provenance, active }: SignalRadarProps) {
  return (
    <div data-testid="signal-radar" className="w-full space-y-4">
      <div className="grid gap-3 sm:grid-cols-1">
        {SIGNALS.map((sig) => {
          const rawValue = breakdown ? breakdown[sig.key] : null;
          const sigProv = provenance ? provenance[sig.key] : undefined;
          const isUnavailable =
            rawValue === null ||
            rawValue === undefined ||
            sigProv?.signal_availability === 'UNAVAILABLE';
          const percent = !isUnavailable && rawValue !== null ? Math.round(Number(rawValue) * 100) : null;
          const modelName = sigProv?.model_name || sig.defaultModel;

          // Semantic color based on signal severity
          const barColor =
            percent === null
              ? 'bg-slate-700'
              : percent >= 80
              ? 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
              : percent >= 60
              ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]'
              : percent >= 30
              ? 'bg-amber-500'
              : 'bg-emerald-500';

          return (
            <div
              key={sig.key}
              data-testid={`signal-${sig.key}`}
              className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tracking-wide text-slate-200 uppercase">
                      {sig.label}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                      {modelName}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400 truncate">{sig.description}</p>
                </div>

                <div className="shrink-0 text-right">
                  {isUnavailable ? (
                    <span className="inline-block rounded border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-xs font-mono font-medium text-slate-400">
                      Unavailable
                    </span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-sm font-bold tracking-tight text-slate-100">
                        {active && percent !== null ? `${percent}%` : '--'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* High precision calibrated gauge bar */}
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800"
                aria-hidden
              >
                {!isUnavailable && active && percent !== null ? (
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
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
