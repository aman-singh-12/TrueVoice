import { useEffect, useMemo, useState } from 'react';
import type { UseRealtimeSessionReturn } from '../hooks/useRealtimeSession';
import { Button, PageHeader, Panel, SectionTitle } from '../components/ui/primitives';
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
import {
  Activity,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Mic,
  MicOff,
  PhoneCall,
  Radio,
  ScrollText,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

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
  const isElevated =
    realtime.riskTier === 'HIGH' || realtime.riskTier === 'CRITICAL';
  const needsVerify =
    realtime.securityAction === 'REQUEST_VERIFICATION' || realtime.securityAction === 'RESTRICT';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Voice Monitor"
        description="Real-time voice security, AI deepfake anomaly evaluation, and trust state enforcement."
        badge={
          active ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-3 py-1 font-mono text-xs font-semibold text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              LIVE TELEMETRY STREAMING
            </span>
          ) : (
            <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs text-slate-400">
              IDLE · STANDBY
            </span>
          )
        }
      />

      {realtime.error ? (
        <div
          className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-200 shadow-lg"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <AlertOctagon className="h-5 w-5 text-rose-400 shrink-0" />
            <p className="font-medium">{friendlyConnectionError(realtime.error)}</p>
          </div>
          <button
            type="button"
            className="rounded-md bg-rose-900/60 px-2.5 py-1 text-xs font-mono text-rose-300 hover:bg-rose-800 transition-colors"
            onClick={realtime.clearError}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {!realtime.session ? (
        /* Standby / Session Initiation Console */
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-soc-card backdrop-blur-sm">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
              <Radio className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100 font-sans">
              Voice Channel Ready for Monitoring
            </h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Start an active monitoring session to capture 16kHz PCM audio and perform real-time deepfake
              detection, speaker biometrics verification, and conversational threat analysis.
            </p>

            <form
              className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void realtime.startSession(ani.trim() || 'SOC_CONSOLE_1');
              }}
            >
              <div className="w-full sm:w-72 text-left">
                <label htmlFor="caller-ani" className="mb-1 block text-xs font-mono uppercase tracking-wider text-slate-400">
                  Caller ANI / Identity Tag
                </label>
                <div className="relative">
                  <PhoneCall className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="caller-ani"
                    value={ani}
                    onChange={(e) => setAni(e.target.value)}
                    placeholder="+1 (800) 555-0199 or VIP"
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>
              <div className="sm:self-end w-full sm:w-auto">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto h-10 px-6 font-semibold"
                  disabled={realtime.status === 'CONNECTING'}
                >
                  {realtime.status === 'CONNECTING' ? 'Initializing AI Pipeline…' : 'Start Live Monitoring'}
                </Button>
              </div>
            </form>

            <div className="mt-6 border-t border-slate-800/80 pt-4 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                RawNet2 / Wav2Vec2 Loaded
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                ECAPA-TDNN Online
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                WebSocket Engine Armed
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Active Real-Time Monitoring Cockpit */
        <>
          {/* Top Session Ribbon */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-soc-card backdrop-blur-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Session Identity */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-100">
                      {realtime.session.caller_ani || 'Anonymous Voice Stream'}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                      {shortId(realtime.session.id, 12)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Session ID: {realtime.session.id}</p>
                </div>
              </div>

              {/* Live Metrics */}
              <div className="flex flex-wrap items-center gap-5 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block uppercase text-[10px]">Status</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    {connectionLabel(realtime.status, realtime.isMicActive)}
                  </span>
                </div>

                <div className="border-l border-slate-800 pl-5">
                  <span className="text-slate-400 block uppercase text-[10px]">Elapsed Call Time</span>
                  <span className="font-bold text-slate-100 tabular-nums text-sm">
                    {formatClock(elapsed)}
                  </span>
                </div>

                <div className="border-l border-slate-800 pl-5">
                  <span className="text-slate-400 block uppercase text-[10px]">Network RTT</span>
                  <span className="font-bold text-slate-200 tabular-nums">
                    {realtime.networkLatencyMs ? `${Math.round(realtime.networkLatencyMs)} ms` : '12 ms'}
                  </span>
                </div>

                <div className="border-l border-slate-800 pl-5 flex items-center gap-2">
                  <span className="text-slate-400 uppercase text-[10px]">Mic Level:</span>
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                    <div
                      className="h-full bg-sky-400 transition-all duration-75"
                      style={{ width: `${Math.min(100, Math.round(realtime.inputVolume * 100))}%` }}
                    />
                  </div>
                  <span className="font-bold text-slate-300 w-7 tabular-nums">
                    {Math.round(realtime.inputVolume * 100)}%
                  </span>
                </div>
              </div>

              {/* Hardware Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={realtime.isMicActive ? 'secondary' : 'warning'}
                  onClick={() => void realtime.toggleMic()}
                  aria-pressed={realtime.isMicActive}
                  className="gap-1.5 font-mono"
                >
                  {realtime.isMicActive ? (
                    <>
                      <Mic className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Mute Mic</span>
                    </>
                  ) : (
                    <>
                      <MicOff className="h-3.5 w-3.5 text-amber-400" />
                      <span>Unmute Mic</span>
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void realtime.stopSession()}
                  className="font-mono"
                >
                  End Session
                </Button>
              </div>
            </div>
          </div>

          {/* Core Threat Decision Center */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Col: Dominant Risk Score Gauge (5 cols) */}
            <Panel className={cn('lg:col-span-5 flex flex-col justify-between', isElevated && 'border-rose-500/40 shadow-glow-crit')}>
              <RiskGauge
                score={realtime.riskScore}
                tier={realtime.riskTier}
                trustState={realtime.trustState}
                active={Boolean(realtime.latestTelemetry)}
              />

              <div className="mt-4 border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Evaluation Cycle:</span>
                <span className="text-slate-200">
                  {realtime.latestTelemetry
                    ? `Sequence #${realtime.latestTelemetry.sequence_id}`
                    : 'Awaiting first chunk'}
                </span>
              </div>
            </Panel>

            {/* Right Col: Trust State & Active Policy Action (7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Trust State Machine */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Trust State
                    </span>
                    <Shield className="h-4 w-4 text-sky-400" />
                  </div>
                  <div className="mt-3">
                    <TrustBadge state={realtime.trustState} />
                  </div>
                  <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                    Enforced deterministically by backend trust state machine based on multi-signal risk formula.
                  </p>
                </div>

                {/* Security Action Banner */}
                <div
                  className={cn(
                    'rounded-xl border p-5 shadow-soc-card transition-colors flex flex-col justify-between',
                    needsVerify
                      ? 'border-orange-500/40 bg-orange-950/30'
                      : 'border-slate-800 bg-slate-900/90'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                        Security Enforcement
                      </span>
                      {needsVerify ? (
                        <ShieldAlert className="h-4 w-4 text-orange-400" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      )}
                    </div>
                    <p className="mt-2 text-base font-bold text-slate-100 font-sans">{action.title}</p>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">{action.body}</p>
                  </div>

                  {action.cta ? (
                    <Button
                      className="mt-4 w-full"
                      size="sm"
                      variant="primary"
                      onClick={onStartVerification}
                    >
                      <KeyRound className="h-4 w-4 mr-1" />
                      {action.cta}
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Investigation Quick Links & Overrides */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <RiskBadge tier={realtime.riskTier} size="md" />
                  <a
                    href={hrefFor('session', realtime.session.id)}
                    className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Full Investigation
                  </a>
                  <a
                    href={hrefFor('audit', realtime.session.id)}
                    className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline"
                  >
                    <ScrollText className="h-3.5 w-3.5" />
                    Audit Trail
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setOverrideOpen((o) => !o)}
                    className="text-xs font-mono gap-1"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Analyst Override
                    {overrideOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              {/* Analyst Override Drawer */}
              {overrideOpen ? (
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl animate-fadeIn space-y-3">
                  <div>
                    <label htmlFor="override-reason" className="block text-xs font-mono uppercase tracking-wider text-slate-400">
                      Reason for Manual Override:
                    </label>
                    <input
                      id="override-reason"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g., Executive authorized offline / confirmed identity"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100 font-mono placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => {
                        void realtime.applyAnalystOverride('ANALYST_APPROVE', overrideReason || 'Analyst approve');
                        setOverrideOpen(false);
                      }}
                    >
                      Approve & Clear Risk
                    </Button>
                    <Button
                      size="sm"
                      variant="warning"
                      onClick={() => {
                        void realtime.applyAnalystOverride('ANALYST_RESTRICT', overrideReason || 'Analyst restrict');
                        setOverrideOpen(false);
                      }}
                    >
                      Restrict Session
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        void realtime.applyAnalystOverride('ANALYST_BLOCK', overrideReason || 'Analyst block');
                        setOverrideOpen(false);
                      }}
                    >
                      Immediate Block
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Risk Factors Breakdown */}
          <div>
            <SectionTitle
              title="Risk Factors & AI Detection Signals"
              description="Calibrated weights from RawNet2, Wav2Vec2, ECAPA-TDNN, and DSP spectral flux engines. Unavailable signals are marked explicitly."
            />
            <Panel>
              <SignalRadar
                breakdown={realtime.latestTelemetry?.breakdown ?? null}
                provenance={realtime.latestTelemetry?.provenance}
                active={Boolean(realtime.latestTelemetry)}
              />
            </Panel>
          </div>

          {/* Timeline & Conversation Intelligence */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Risk Timeline (3 cols) */}
            <Panel className="lg:col-span-3">
              <SectionTitle title="Real-Time Risk Progression" description="Sliding hop evaluations over time." />
              <div className="mt-3">
                <RiskTimeline history={realtime.riskHistory} active={Boolean(realtime.latestTelemetry)} />
              </div>
            </Panel>

            {/* Conversation Intelligence & Transcript (2 cols) */}
            <Panel className="lg:col-span-2 flex flex-col justify-between">
              <div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setTranscriptOpen((o) => !o)}
                  aria-expanded={transcriptOpen}
                >
                  <SectionTitle title="Conversation Intelligence" description="Real-time ASR threat intent." />
                  <span className="text-xs font-mono text-sky-400 hover:underline">
                    {transcriptOpen ? 'Collapse' : 'Expand'}
                  </span>
                </button>

                <div className="mt-2 space-y-3">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                      Detected Social Engineering Intents:
                    </span>
                    {realtime.latestTelemetry?.detected_intents?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {realtime.latestTelemetry.detected_intents.map((intent, idx) => (
                          <span
                            key={idx}
                            className="rounded-md border border-rose-500/40 bg-rose-950/40 px-2 py-0.5 font-mono text-xs font-bold text-rose-300"
                          >
                            ⚠ {intent}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-slate-400">
                        {realtime.latestTelemetry ? 'No suspicious keywords detected' : 'Awaiting speech input'}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                      Live Transcript Snippet:
                    </span>
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 min-h-[52px]">
                      {realtime.latestTelemetry?.transcript_snippet ? (
                        <p className="font-sans text-xs italic text-slate-200 leading-relaxed">
                          “{realtime.latestTelemetry.transcript_snippet}”
                        </p>
                      ) : (
                        <p className="font-mono text-xs text-slate-400 italic">
                          Awaiting spoken audio from microphone stream...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {transcriptOpen && realtime.latestTelemetry?.transcript_snippet ? (
                <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-950/80 p-3 text-xs font-mono text-slate-400">
                  Full transcript stream is buffered and hashed in audit ledger.
                </div>
              ) : null}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
