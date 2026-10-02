import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import type { AuditLogResponse, RiskAssessmentResponse, SessionDetailResponse } from '../types/api';
import { Button, EmptyState, ErrorState, PageHeader, Panel, SectionTitle, Skeleton } from '../components/ui/primitives';
import { RiskBadge, TrustBadge } from '../components/ui/badges';
import { SignalRadar } from '../components/SignalRadar';
import { formatTimestamp, roundScore } from '../lib/format';
import { hrefFor } from '../lib/routing';
import type { RiskTelemetryBroadcast } from '../types/telemetry';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Radio,
  ScrollText,
  Shield,
  ShieldAlert,
} from 'lucide-react';

export function InvestigateView({
  sessionId,
  variant,
}: {
  sessionId: string;
  variant: 'session' | 'incident';
}) {
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [latest, setLatest] = useState<RiskAssessmentResponse | null>(null);
  const [timeline, setTimeline] = useState<RiskAssessmentResponse[]>([]);
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [d, l, t, a] = await Promise.all([
        api.getSession(sessionId),
        api.getLatestRisk(sessionId),
        api.getRiskTimeline(sessionId, 0, 50),
        api.getAuditLogs(sessionId),
      ]);
      setDetail(d);
      setLatest(l);
      setTimeline(t);
      setLogs(a);
    } catch (err) {
      setError((err as Error).message || 'Unable to load session details.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Unable to retrieve investigation record" body={error} onRetry={load} />;
  }

  if (!detail) {
    return <EmptyState title="Session Not Found" body="The TrueVoice backend did not return this session record." />;
  }

  const breakdown = latest
    ? {
        deepfake: latest.synthetic_prob,
        speaker_similarity: latest.speaker_similarity,
        forensic_anomaly: latest.forensic_score,
        conversational_threat: latest.conversational_score,
        context_sensitivity: 0,
      }
    : null;

  const provenance = latest?.evidence_provenance as RiskTelemetryBroadcast['provenance'] | undefined;
  const contextUnavailable =
    !provenance?.context_sensitivity || provenance.context_sensitivity.signal_availability === 'UNAVAILABLE';

  const isIncident = variant === 'incident';
  const peak = roundScore(detail.peak_risk_score);

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <a
          href={hrefFor(isIncident ? 'incidents' : 'sessions')}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-sky-400 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {isIncident ? 'Incidents List' : 'Sessions List'}
        </a>
      </div>

      <PageHeader
        title={isIncident ? `Security Incident: ${detail.caller_ani || detail.id.slice(0, 8)}` : `Session Investigation: ${detail.caller_ani || detail.id.slice(0, 8)}`}
        description={`Cryptographic forensics and timeline breakdown for voice stream ${detail.id}`}
        badge={
          <span className="font-mono text-xs rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-slate-300">
            {detail.id}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <a href={hrefFor('monitor')}>
              <Button size="sm" variant="secondary" className="gap-1.5 font-mono">
                <Radio className="h-3.5 w-3.5 text-sky-400" />
                Live Monitor
              </Button>
            </a>
            <a href={hrefFor('audit', detail.id)}>
              <Button size="sm" variant="primary" className="gap-1.5 font-mono">
                <ScrollText className="h-3.5 w-3.5" />
                Audit Ledger
              </Button>
            </a>
          </div>
        }
      />

      {/* Top Threat Triage Metrics */}
      <div className="grid gap-4 sm:grid-cols-4">
        <MetaCard
          label="Enforced Trust State"
          icon={<Shield className="h-4 w-4 text-sky-400" />}
          value={<TrustBadge state={detail.current_trust_state} />}
        />
        <MetaCard
          label="Peak Composite Risk"
          icon={<ShieldAlert className="h-4 w-4 text-rose-400" />}
          value={
            <div className="flex items-baseline gap-1.5 font-mono">
              <span
                className={`text-2xl font-extrabold ${
                  peak !== null && peak >= 60 ? 'text-rose-400' : 'text-slate-100'
                }`}
              >
                {peak ?? '—'}
              </span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
          }
        />
        <MetaCard
          label="Latest Assessment"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          value={
            latest ? (
              <RiskBadge tier={latest.risk_tier} size="md" />
            ) : (
              <span className="font-mono text-xs text-slate-400">Unavailable</span>
            )
          }
        />
        <MetaCard
          label="Session Start"
          icon={<Clock className="h-4 w-4 text-slate-400" />}
          value={<span className="font-sans text-xs text-slate-200">{formatTimestamp(detail.started_at)}</span>}
        />
      </div>

      {/* Section 1: Risk Factors & AI Provenance */}
      <div>
        <SectionTitle
          title="Multi-Signal Risk Factor Analysis"
          description="Acoustic, biometric, and conversational signals recorded for this interaction."
        />
        <Panel>
          {breakdown ? (
            <SignalRadar
              breakdown={{
                ...breakdown,
                speaker_similarity: breakdown.speaker_similarity as number | null,
              }}
              provenance={{
                ...provenance,
                context_sensitivity: contextUnavailable
                  ? { signal_availability: 'UNAVAILABLE' }
                  : provenance?.context_sensitivity,
              }}
              active={true}
            />
          ) : (
            <p className="font-mono text-xs text-slate-400">
              Risk factor breakdown scores are unavailable for this session.
            </p>
          )}
        </Panel>
      </div>

      {/* Section 2: Historical Timeline Evaluations */}
      <div>
        <SectionTitle
          title="Evaluation Timeline"
          description="Sequential risk telemetry evaluation points generated during this call."
        />
        <Panel padded={false}>
          {timeline.length === 0 ? (
            <p className="p-6 font-mono text-xs text-slate-400 text-center">
              No periodic risk assessments recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b border-slate-800 bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Composite Risk</th>
                    <th className="px-5 py-3">Deepfake Prob</th>
                    <th className="px-5 py-3">Speaker Sim</th>
                    <th className="px-5 py-3 text-right">Risk Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {timeline
                    .slice()
                    .reverse()
                    .slice(0, 10)
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-2.5 text-slate-400 font-sans">
                          {formatTimestamp(item.recorded_at)}
                        </td>
                        <td className="px-5 py-2.5 font-bold text-slate-100">
                          {roundScore(item.composite_risk) ?? '—'} / 100
                        </td>
                        <td className="px-5 py-2.5 text-slate-300">
                          {item.synthetic_prob !== null ? `${Math.round(item.synthetic_prob * 100)}%` : '—'}
                        </td>
                        <td className="px-5 py-2.5 text-slate-300">
                          {item.speaker_similarity !== null
                            ? `${Math.round(item.speaker_similarity * 100)}%`
                            : 'Unavailable'}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <RiskBadge tier={item.risk_tier} size="sm" />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Section 3: Conversation Intelligence & Intents */}
      {latest?.primary_factors?.length ? (
        <div>
          <SectionTitle
            title="Conversation Intelligence & Factors"
            description="Primary drivers and intents flagged by NLP models."
          />
          <Panel className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {latest.primary_factors.map((factor, idx) => (
                <span
                  key={idx}
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1 font-mono text-xs text-slate-200"
                >
                  ⚡ {factor}
                </span>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {/* Section 4: Audit Trail References */}
      <div>
        <SectionTitle
          title="Cryptographic Audit References"
          description="Tamper-evident audit ledger entries sealed for this session."
          action={
            <a href={hrefFor('audit', detail.id)} className="font-mono text-xs text-sky-400 hover:underline">
              Verify Full Chain →
            </a>
          }
        />
        <Panel padded={false}>
          {logs.length === 0 ? (
            <p className="p-6 font-mono text-xs text-slate-400 text-center">
              No audit entries recorded for this session.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {logs.slice(0, 6).map((log) => {
                const isOpen = openLog === log.id;
                return (
                  <li key={log.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left"
                      onClick={() => setOpenLog(isOpen ? null : log.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-sky-400">
                          {log.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          Hash: {log.event_hash ? log.event_hash.slice(0, 12) + '…' : 'None'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-sans text-xs text-slate-400">{formatTimestamp(log.created_at)}</span>
                        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs">
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mb-2">
                          <div>
                            <span className="block text-slate-400">Trust State:</span>
                            <TrustBadge state={log.trust_state} />
                          </div>
                          <div>
                            <span className="block text-slate-400">Previous Hash:</span>
                            <span className="text-slate-300 truncate block">{log.prev_event_hash || 'GENESIS'}</span>
                          </div>
                        </div>
                        <span className="block text-slate-400 text-[11px] mb-1">Payload JSON:</span>
                        <pre className="overflow-x-auto rounded bg-slate-900 p-2.5 text-slate-300 text-[11px] leading-relaxed">
                          {JSON.stringify(log.payload_json, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function MetaCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-soc-card">
      <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
        <span>{label}</span>
        {icon}
      </div>
      <div>{value}</div>
    </div>
  );
}
