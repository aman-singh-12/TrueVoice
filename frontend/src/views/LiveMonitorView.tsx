import { useEffect, useMemo, useState } from 'react';
import type { UseRealtimeSessionReturn } from '../hooks/useRealtimeSession';
import { Button, EmptyState, PageHeader, Panel, SectionTitle } from '../components/ui/primitives';
import { RiskBadge, TrustBadge } from '../components/ui/badges';
import { RiskGauge } from '../components/RiskGauge';
import { SignalRadar } from '../components/SignalRadar';
import { RiskTimeline } from '../components/RiskTimeline';
import {
  connectionLabel,
  elapsedSeconds,
  formatClock,
  friendlyConnectionError,
  SECURITY_ACTION_COPY,
  shortId,
} from '../lib/format';
import { hrefFor } from '../lib/routing';
import { cn } from '../lib/cn';

export function LiveMonitorView({
  realtime,
  onStartVerification,
}: {
  realtime: UseRealtimeSessionReturn;
  onStartVerification: () => void;
}) {
  const [ani, setAni] = useState('');
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  const active = Boolean(realtime.session) && realtime.status !== 'DISCONNECTED';

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const elapsed = useMemo(() => {
    if (!realtime.session) return 0;
    void now;
    return elapsedSeconds(realtime.session.started_at, realtime.session.ended_at);
  }, [realtime.session, now]);

  const action = SECURITY_ACTION_COPY[realtime.securityAction] || SECURITY_ACTION_COPY.ALLOW;
  const needsVerify =
    realtime.securityAction === 'REQUEST_VERIFICATION' || realtime.securityAction === 'RESTRICT';

  return (
    <div>
      <PageHeader
        title="Live monitor"
        description="Watch risk, trust, and policy action for the current voice session."
      />

      {realtime.error ? (
        <div className="mb-4 flex items-start justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-crit" role="alert">
          <p>{friendlyConnectionError(realtime.error)}</p>
          <button type="button" className="text-xs underline" onClick={realtime.clearError}>
            Dismiss
          </button>
        </div>
      ) : null}

      {!realtime.session ? (
        <EmptyState
          title="No session is being monitored"
          body="Start a session to stream microphone audio to TrueVoice and receive live risk telemetry."
          action={
            <form
              className="mt-2 flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void realtime.startSession(ani.trim() || 'CONSOLE');
              }}
            >
              <div>
                <label htmlFor="caller-ani" className="mb-1 block text-xs font-medium text-mute">
                  Caller ID
                </label>
                <input
                  id="caller-ani"
                  value={ani}
                  onChange={(e) => setAni(e.target.value)}
                  placeholder="Optional caller ANI"
                  className="h-9 w-56 rounded-md border border-line px-3 text-sm"
                />
              </div>
              <Button type="submit" variant="primary" disabled={realtime.status === 'CONNECTING'}>
                {realtime.status === 'CONNECTING' ? 'Connecting…' : 'Start monitoring'}
              </Button>
            </form>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-line bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs text-mute">Session</p>
              <p className="truncate font-mono text-sm text-ink" title={realtime.session.id}>
                {shortId(realtime.session.id, 12)} · {realtime.session.caller_ani || 'No caller ID'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <p className="text-xs text-mute">Connection</p>
                <p className="font-medium">{connectionLabel(realtime.status, realtime.isMicActive)}</p>
              </div>
              <div>
                <p className="text-xs text-mute">Elapsed</p>
                <p className="font-medium tabular-nums">{formatClock(elapsed)}</p>
              </div>
              <div>
                <p className="text-xs text-mute">Latency</p>
                <p className="font-medium tabular-nums">
                  {realtime.networkLatencyMs ? `${Math.round(realtime.networkLatencyMs)} ms` : '—'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void realtime.toggleMic()}
                aria-pressed={realtime.isMicActive}
              >
                {realtime.isMicActive ? 'Mute microphone' : 'Unmute microphone'}
              </Button>
              <Button size="sm" variant="danger" onClick={() => void realtime.stopSession()}>
                End session
              </Button>
            </div>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-12">
            <Panel className="lg:col-span-5">
              <RiskGauge
                score={realtime.riskScore}
                tier={realtime.riskTier}
                trustState={realtime.trustState}
                active={Boolean(realtime.latestTelemetry)}
              />
            </Panel>
            <div className="lg:col-span-7 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-white px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-mute">Trust state</p>
                  <div className="mt-2">
                    <TrustBadge state={realtime.trustState} />
                  </div>
                  <p className="mt-2 text-sm text-mute">Reported by the backend for this session.</p>
                </div>
                <div
                  className={cn(
                    'rounded-lg border px-4 py-4',
                    needsVerify ? 'border-orange-200 bg-orange-50' : 'border-line bg-white'
                  )}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-mute">Security action</p>
                  <p className="mt-2 text-base font-semibold text-ink">{action.title}</p>
                  <p className="mt-1 text-sm text-mute">{action.body}</p>
                  {action.cta ? (
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="primary"
                      onClick={onStartVerification}
                    >
                      {action.cta}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge tier={realtime.riskTier} />
                <a href={hrefFor('session', realtime.session.id)} className="text-sm text-brand hover:underline">
                  Open investigation
                </a>
                <a href={hrefFor('audit', realtime.session.id)} className="text-sm text-brand hover:underline">
                  Audit log
                </a>
              </div>
            </div>
          </div>

          <SectionTitle title="Risk factors" description="Live signal breakdown. Unavailable signals are not shown as zero." />
          <Panel className="mb-6">
            <SignalRadar
              breakdown={realtime.latestTelemetry?.breakdown ?? null}
              provenance={realtime.latestTelemetry?.provenance}
              active={Boolean(realtime.latestTelemetry)}
            />
          </Panel>

          <div className="mb-6 grid gap-6 lg:grid-cols-5">
            <Panel className="lg:col-span-3" padded={false}>
              <div className="border-b border-line px-5 py-3">
                <h2 className="text-base font-semibold">Risk over time</h2>
              </div>
              <div className="p-4">
                <RiskTimeline history={realtime.riskHistory} active={Boolean(realtime.latestTelemetry)} />
              </div>
            </Panel>
            <Panel className="lg:col-span-2">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setTranscriptOpen((o) => !o)}
                aria-expanded={transcriptOpen}
              >
                <h2 className="text-base font-semibold">Conversation intelligence</h2>
                <span className="text-xs text-mute">{transcriptOpen ? 'Hide' : 'Show'}</span>
              </button>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-mute">Detected intent</p>
              <p className="mt-1 text-sm">
                {realtime.latestTelemetry?.detected_intents?.length
                  ? realtime.latestTelemetry.detected_intents.join(', ')
                  : 'None detected'}
              </p>
              {transcriptOpen ? (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-mute">Transcript</p>
                  <p className="mt-1 text-sm italic text-ink">
                    {realtime.latestTelemetry?.transcript_snippet
                      ? `“${realtime.latestTelemetry.transcript_snippet}”`
                      : 'No transcript snippet yet.'}
                  </p>
                </div>
              ) : realtime.latestTelemetry?.transcript_snippet ? (
                <p className="mt-2 line-clamp-2 text-sm text-mute">
                  {realtime.latestTelemetry.transcript_snippet}
                </p>
              ) : null}
            </Panel>
          </div>

          <SectionTitle title="Analyst controls" />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onStartVerification}>
              Dispatch verification
            </Button>
            <Button size="sm" onClick={() => setOverrideOpen((o) => !o)}>
              Override
            </Button>
            <span className="text-xs text-mute">
              Input level {Math.round(realtime.inputVolume * 100)}%
            </span>
          </div>
          {overrideOpen ? (
            <Panel className="mt-3 max-w-md">
              <label htmlFor="override-reason" className="text-sm font-medium">
                Reason
              </label>
              <input
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-line px-3 text-sm"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    void realtime.applyAnalystOverride('ANALYST_APPROVE', overrideReason || 'Analyst approve');
                    setOverrideOpen(false);
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="warning"
                  onClick={() => {
                    void realtime.applyAnalystOverride('ANALYST_RESTRICT', overrideReason || 'Analyst restrict');
                    setOverrideOpen(false);
                  }}
                >
                  Restrict
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    void realtime.applyAnalystOverride('ANALYST_BLOCK', overrideReason || 'Analyst block');
                    setOverrideOpen(false);
                  }}
                >
                  Block
                </Button>
              </div>
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
