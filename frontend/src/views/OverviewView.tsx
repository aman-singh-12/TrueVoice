import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { hrefFor } from '../lib/routing';
import { formatTimestamp, isActiveSession, isIncidentSession, roundScore } from '../lib/format';
import { EmptyState, ErrorState, PageHeader, Panel, SectionTitle, Skeleton } from '../components/ui/primitives';
import { RiskBadge, StatusDot, TrustBadge } from '../components/ui/badges';
import { useSessions } from '../hooks/useSessions';
import type { UseRealtimeSessionReturn } from '../hooks/useRealtimeSession';
import type { PolicyResponse } from '../types/api';

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
  const live = realtime.session && realtime.status !== 'DISCONNECTED';
  const healthy = health?.status && health.status.toUpperCase() !== 'UNHEALTHY';

  return (
    <div>
      <PageHeader
        title="Overview"
        description="System health, live monitoring, and items that need attention."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-mute">System</p>
          {healthError ? (
            <StatusDot tone="danger" label="Backend unavailable" />
          ) : health ? (
            <div className="mt-2">
              <p className="text-lg font-semibold text-ink">{healthy ? 'Healthy' : health.status}</p>
              <p className="text-xs text-mute">Database {health.database}</p>
            </div>
          ) : (
            <Skeleton className="mt-2 h-8 w-24" />
          )}
        </div>
        <div className="rounded-lg bg-white px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-mute">Monitoring</p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {live ? 'Session in progress' : `${active.length} active session${active.length === 1 ? '' : 's'}`}
          </p>
          <a href={hrefFor('monitor')} className="mt-1 inline-block text-sm text-brand hover:underline">
            Open live monitor
          </a>
        </div>
        <div className="rounded-lg bg-white px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-mute">Alerts</p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {incidents.length === 0 ? 'No active incidents' : `${incidents.length} requiring attention`}
          </p>
          <a href={hrefFor('incidents')} className="mt-1 inline-block text-sm text-brand hover:underline">
            Review incidents
          </a>
        </div>
      </div>

      {error ? <ErrorState title="Unable to load sessions" body={error} onRetry={refresh} /> : null}

      <div className="mb-8 grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <SectionTitle title="Current risk" description="From the live session, if monitoring." />
          {live && realtime.latestTelemetry ? (
            <div>
              <p className="text-5xl font-semibold tabular-nums text-ink">
                {roundScore(realtime.riskScore) ?? '—'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RiskBadge tier={realtime.riskTier} />
                <TrustBadge state={realtime.trustState} />
              </div>
              <p className="mt-3 text-sm text-mute">
                Action: {realtime.securityAction.replace(/_/g, ' ').toLowerCase()}
              </p>
            </div>
          ) : (
            <p className="text-sm text-mute">No live telemetry. Start monitoring to see risk.</p>
          )}
        </Panel>

        <Panel className="lg:col-span-3">
          <SectionTitle title="Needs attention" />
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : incidents.length === 0 ? (
            <p className="text-sm text-mute">Nothing requires attention.</p>
          ) : (
            <ul className="divide-y divide-line">
              {incidents.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <a href={hrefFor('incident', s.id)} className="text-sm font-medium text-ink hover:underline">
                      {s.caller_ani || shortFallback(s.id)}
                    </a>
                    <p className="text-xs text-mute">{formatTimestamp(s.started_at)}</p>
                  </div>
                  <TrustBadge state={s.current_trust_state} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle title="Recent sessions" />
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : sessions.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              body="Start a live monitoring session to create the first record."
              action={
                <a href={hrefFor('monitor')} className="text-sm font-medium text-brand hover:underline">
                  Go to live monitor
                </a>
              }
            />
          ) : (
            <ul className="rounded-lg border border-line bg-white">
              {sessions.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0">
                  <a href={hrefFor('session', s.id)} className="text-sm font-medium hover:underline">
                    {s.caller_ani || s.id.slice(0, 8)}
                  </a>
                  <span className="text-xs text-mute">Peak {roundScore(s.peak_risk_score) ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <SectionTitle title="System status" />
          <Panel>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-mute">Service</dt>
                <dd className="font-medium">{health?.status ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="text-mute">Version</dt>
                <dd className="font-medium">{health?.version ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="text-mute">Database</dt>
                <dd className="font-medium">{health?.database ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="text-mute">Active policy</dt>
                <dd className="font-medium">{policy?.policy_name ?? 'Unavailable'}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function shortFallback(id: string) {
  return `Session ${id.slice(0, 8)}`;
}
