import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { hrefFor } from '../lib/routing';
import { formatTimestamp, isActiveSession, isIncidentSession, roundScore } from '../lib/format';
import { EmptyState, ErrorState, PageHeader, Panel, SectionTitle, Skeleton, Button } from '../components/ui/primitives';
import { RiskBadge, StatusDot, TrustBadge } from '../components/ui/badges';
import { useSessions } from '../hooks/useSessions';
import type { UseRealtimeSessionReturn } from '../hooks/useRealtimeSession';
import type { PolicyResponse } from '../types/api';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  FileAudio,
  Radio,
  Server,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export function OverviewView({ realtime }: { realtime: UseRealtimeSessionReturn }) {
  const { sessions, loading, error, refresh } = useSessions();
  const [health, setHealth] = useState<{ status: string; database: string; version: string } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<PolicyResponse | null>(null);

  useEffect(() => {
    api
      .getHealth()
      .then((h) => {
        setHealth(h);
        setHealthError(null);
      })
      .catch(() => {
        setHealth(null);
        setHealthError('Unable to connect to the TrueVoice backend.');
      });
    api.getActivePolicy().then(setPolicy).catch(() => setPolicy(null));
  }, []);

  const active = sessions.filter(isActiveSession);
  const incidents = sessions.filter(isIncidentSession);
  const live = Boolean(realtime.session) && realtime.status !== 'DISCONNECTED';
  const healthy = health?.status && health.status.toUpperCase() !== 'UNHEALTHY';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Operations Overview"
        description="Real-time voice integrity posture, active call telemetry, and security incidents requiring investigation."
        badge={
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-mono font-medium text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            AI Pipeline Active
          </span>
        }
        actions={
          <Button size="sm" onClick={() => void refresh()}>
            Refresh Telemetry
          </Button>
        }
      />

      {/* Top 3 SOC Pulse Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* System Health */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400">
            <span>Platform Status</span>
            <Server className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3">
            {healthError ? (
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <StatusDot tone="danger" label="Backend Unavailable" />
              </div>
            ) : health ? (
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <p className="text-xl font-bold tracking-tight text-slate-100">
                    {healthy ? 'Operational' : health.status}
                  </p>
                </div>
                <p className="mt-1 text-xs font-mono text-slate-400">
                  Database: {health.database} · v{health.version}
                </p>
              </div>
            ) : (
              <Skeleton className="h-10 w-32" />
            )}
          </div>
        </div>

        {/* Active Monitored Sessions */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400">
            <span>Voice Streams</span>
            <Activity className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <p className="text-2xl font-bold font-mono tracking-tight text-slate-100">
                {live ? '1 Live Stream' : `${active.length} Active`}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {live ? 'Microphone audio actively streaming' : 'Voice channels monitored by SOC'}
              </p>
            </div>
            <a
              href={hrefFor('monitor')}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1"
            >
              Open Console →
            </a>
          </div>
        </div>

        {/* Security Incidents / Alerts */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400">
            <span>Threat Incidents</span>
            <ShieldAlert className={incidents.length > 0 ? 'h-4 w-4 text-rose-400' : 'h-4 w-4 text-slate-400'} />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <p
                className={`text-2xl font-bold font-mono tracking-tight ${
                  incidents.length > 0 ? 'text-rose-400' : 'text-slate-100'
                }`}
              >
                {incidents.length === 0 ? '0 Incidents' : `${incidents.length} Under Review`}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {incidents.length === 0 ? 'All calls verified within safe baseline' : 'Non-trusted trust state calls'}
              </p>
            </div>
            <a
              href={hrefFor('incidents')}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1"
            >
              Triage →
            </a>
          </div>
        </div>
      </div>

      {/* Primary Voice File Analysis Demonstration CTA */}
      <div className="rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 p-5 shadow-soc-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
              <FileAudio className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100 font-sans">Dual Audio File Forensic Analysis</h2>
                <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-sky-300 border border-sky-500/30">
                  Primary Flow
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400 max-w-2xl leading-relaxed">
                Upload a genuine reference voice recording and suspected audio sample to perform authoritative multi-signal deepfake detection, ECAPA-TDNN speaker verification, and DSP acoustic forensics.
              </p>
            </div>
          </div>
          <a
            href={hrefFor('analyze')}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 text-xs font-semibold font-mono tracking-wide shadow-[0_0_15px_rgba(2,132,199,0.35)] transition-all shrink-0"
          >
            <span>Launch Analysis</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {error ? <ErrorState title="Unable to retrieve sessions" body={error} onRetry={refresh} /> : null}

      {/* Middle Section: Live Risk Telemetry or Readiness Posture + Active Attention Queue */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Current Risk Snapshot (Left 5 Cols) */}
        <Panel className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <SectionTitle
              title="Live Risk Posture"
              description="Real-time multi-model evaluation for active voice streaming."
            />
            {live && realtime.latestTelemetry ? (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">Composite Risk</span>
                  <RiskBadge tier={realtime.riskTier} />
                </div>
                <div className="my-3 flex items-baseline gap-2">
                  <span className="font-mono text-5xl font-extrabold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                    {roundScore(realtime.riskScore) ?? '—'}
                  </span>
                  <span className="font-mono text-sm text-slate-400">/ 100</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Trust State</span>
                    <TrustBadge state={realtime.trustState} />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Action</span>
                    <span className="font-mono text-xs font-bold text-sky-400">
                      {realtime.securityAction.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center">
                <Radio className="h-8 w-8 text-slate-500 mb-2" />
                <p className="text-sm font-medium text-slate-300">Live Monitor is Idle</p>
                <p className="mt-1 text-xs text-slate-400 max-w-xs">
                  Connect microphone to stream voice audio and evaluate deepfake, speaker, and conversational threat signals.
                </p>
                <a href={hrefFor('monitor')} className="mt-4">
                  <Button size="sm" variant="primary">
                    Launch Live Stream
                  </Button>
                </a>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-slate-800/60 bg-slate-950/60 p-3 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Active Defense Policy</span>
            <span className="font-bold text-slate-200">{policy?.policy_name || 'Standard Enterprise Zero-Trust'}</span>
          </div>
        </Panel>

        {/* Needs Attention / Active Incidents (Right 7 Cols) */}
        <Panel className="lg:col-span-7">
          <SectionTitle
            title="Calls Requiring Attention"
            description="Sessions flagged in caution, verification, restricted, or blocked states."
            action={
              <a href={hrefFor('incidents')} className="text-xs font-mono text-sky-400 hover:underline">
                View All ({incidents.length})
              </a>
            }
          />
          {loading ? (
            <div className="space-y-3 mt-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/30 py-10 text-center">
              <ShieldCheck className="h-8 w-8 text-emerald-400 mb-2" />
              <p className="text-sm font-semibold text-slate-200">No Immediate Incidents</p>
              <p className="text-xs text-slate-400 max-w-sm mt-0.5">
                All voice sessions are operating within verified baseline security limits.
              </p>
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
              <ul className="divide-y divide-slate-800/80">
                {incidents.slice(0, 5).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <a
                          href={hrefFor('incident', s.id)}
                          className="font-mono text-xs font-bold text-sky-400 hover:underline truncate"
                        >
                          {s.caller_ani || `Session ${s.id.slice(0, 8)}`}
                        </a>
                        <span className="font-mono text-[10px] text-slate-400">{s.id.slice(0, 8)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{formatTimestamp(s.started_at)}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-mono">
                        <span className="text-[10px] text-slate-400 block">Peak Risk</span>
                        <span className="text-xs font-bold text-rose-400">
                          {roundScore(s.peak_risk_score) ?? '—'}
                        </span>
                      </div>
                      <TrustBadge state={s.current_trust_state} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {/* Bottom Section: Recent Sessions + SOC Engine Stack */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Sessions */}
        <div>
          <SectionTitle
            title="Recent Voice Sessions"
            description="Historical call records verified by TrueVoice."
            action={
              <a href={hrefFor('sessions')} className="text-xs font-mono text-sky-400 hover:underline">
                All Sessions →
              </a>
            }
          />
          {loading ? (
            <Skeleton className="h-48 w-full mt-2" />
          ) : sessions.length === 0 ? (
            <EmptyState
              title="No Recorded Sessions"
              body="Initiate your first voice stream from Live Monitor to begin real-time analysis."
              action={
                <a href={hrefFor('monitor')}>
                  <Button size="sm" variant="primary">
                    Start Stream
                  </Button>
                </a>
              }
            />
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-soc-card">
              <ul className="divide-y divide-slate-800/80">
                {sessions.slice(0, 5).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
                  >
                    <div>
                      <a
                        href={hrefFor('session', s.id)}
                        className="text-xs font-mono font-semibold text-slate-200 hover:text-sky-400 hover:underline"
                      >
                        {s.caller_ani || `Session ${s.id.slice(0, 8)}`}
                      </a>
                      <p className="text-[11px] text-slate-400">{formatTimestamp(s.started_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-400">
                        Peak: <strong className="text-slate-200">{roundScore(s.peak_risk_score) ?? '—'}</strong>
                      </span>
                      <TrustBadge state={s.current_trust_state} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* System & Model Architecture Readiness */}
        <div>
          <SectionTitle
            title="Active Forensic Model Stack"
            description="Real-time multi-signal inference engines."
          />
          <Panel className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                  <Zap className="h-3.5 w-3.5 text-sky-400" />
                  <span>Deepfake Engine</span>
                </div>
                <p className="mt-1 font-mono text-xs font-bold text-slate-200">RawNet2 / Wav2Vec2</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">● Ready · 16kHz PCM</p>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                  <Cpu className="h-3.5 w-3.5 text-sky-400" />
                  <span>Biometrics Engine</span>
                </div>
                <p className="mt-1 font-mono text-xs font-bold text-slate-200">ECAPA-TDNN Voiceprint</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">● Enrolled Profiles Active</p>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                  <Activity className="h-3.5 w-3.5 text-amber-400" />
                  <span>ASR & Social Eng.</span>
                </div>
                <p className="mt-1 font-mono text-xs font-bold text-slate-200">Whisper + NLP Intent</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">● Threat Heuristics Armed</p>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                  <Database className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Audit Trail</span>
                </div>
                <p className="mt-1 font-mono text-xs font-bold text-slate-200">SHA-256 Merkle Ledger</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">● Tamper-Evident Chain</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs font-mono text-slate-400">
              <span>Backend Connectivity:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {health?.status ? 'TrueVoice Core API (Healthy)' : 'Offline / Reconnecting'}
              </span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
