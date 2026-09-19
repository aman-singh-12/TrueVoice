import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import type { AuditLogResponse, RiskAssessmentResponse, SessionDetailResponse } from '../types/api';
import { Button, EmptyState, ErrorState, PageHeader, Panel, SectionTitle, Skeleton } from '../components/ui/primitives';
import { RiskBadge, TrustBadge } from '../components/ui/badges';
import { SignalRadar } from '../components/SignalRadar';
import { formatTimestamp, roundScore } from '../lib/format';
import { hrefFor } from '../lib/routing';
import type { RiskTelemetryBroadcast } from '../types/telemetry';

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
      <div>
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Unable to load this session" body={error} onRetry={load} />;
  }

  if (!detail) {
    return <EmptyState title="Session not found" body="The backend did not return this session." />;
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
  const contextUnavailable = !provenance?.context_sensitivity || provenance.context_sensitivity.signal_availability === 'UNAVAILABLE';

  return (
    <div>
      <PageHeader
        title={variant === 'incident' ? 'Incident' : 'Session'}
        description={detail.caller_ani || detail.id}
        actions={
          <div className="flex gap-2">
            <a href={hrefFor('monitor')}>
              <Button size="sm">Live monitor</Button>
            </a>
            <a href={hrefFor('audit', detail.id)}>
              <Button size="sm">Audit</Button>
            </a>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Meta label="Trust" value={<TrustBadge state={detail.current_trust_state} />} />
        <Meta
          label="Peak risk"
          value={<span className="text-2xl font-semibold tabular-nums">{roundScore(detail.peak_risk_score) ?? '—'}</span>}
        />
        <Meta
          label="Latest tier"
          value={latest ? <RiskBadge tier={latest.risk_tier} /> : <span className="text-sm text-mute">Unavailable</span>}
        />
        <Meta label="Started" value={<span className="text-sm">{formatTimestamp(detail.started_at)}</span>} />
      </div>

      <SectionTitle title="Timeline" />
      <Panel className="mb-6" padded={false}>
        {timeline.length === 0 ? (
          <p className="px-5 py-6 text-sm text-mute">No risk assessments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {timeline.slice().reverse().slice(0, 12).map((item) => (
              <li key={item.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-mute">{formatTimestamp(item.recorded_at)}</span>
                <span className="tabular-nums font-medium">{roundScore(item.composite_risk) ?? '—'}</span>
                <RiskBadge tier={item.risk_tier} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <SectionTitle title="Risk factors" />
      <Panel className="mb-6">
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
            active
          />
        ) : (
          <p className="text-sm text-mute">Risk factor scores are unavailable for this session.</p>
        )}
      </Panel>

      {latest?.primary_factors?.length ? (
        <Panel className="mb-6">
          <SectionTitle title="Conversation intelligence" />
          <p className="text-sm">
            {latest.primary_factors.join(', ')}
          </p>
        </Panel>
      ) : null}

      <SectionTitle title="Security actions" />
      <Panel className="mb-6">
        <p className="text-sm text-mute">
          Live policy actions appear on the monitor while a session is streaming. Historical assessments do not invent an action locally.
        </p>
        {latest ? (
          <p className="mt-2 text-sm">
            Latest recorded tier: <strong>{latest.risk_tier}</strong>
          </p>
        ) : null}
      </Panel>

      <SectionTitle title="Audit references" />
      <Panel padded={false}>
        {logs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-mute">No audit events for this session.</p>
        ) : (
          <ul>
            {logs.slice(0, 8).map((log) => (
              <li key={log.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-3 text-left text-sm"
                  onClick={() => setOpenLog(openLog === log.id ? null : log.id)}
                >
                  <span>{log.event_type.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-mute">{formatTimestamp(log.created_at)}</span>
                </button>
                {openLog === log.id ? (
                  <pre className="overflow-x-auto bg-canvas px-5 py-3 text-xs text-mute">
                    {JSON.stringify(log.payload_json, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-mute">{label}</p>
      <div className="mt-1">{value}</div>
    </div>
  );
}
