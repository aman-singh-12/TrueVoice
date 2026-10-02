import { useState } from 'react';
import { SECURITY_ACTION_COPY, shortId } from '../lib/format';
import { hrefFor } from '../lib/routing';
import { Button, EmptyState, PageHeader, Panel, SectionTitle } from '../components/ui/primitives';
import { TrustBadge, RiskBadge } from '../components/ui/badges';
import type { UseRealtimeSessionReturn } from '../hooks/useRealtimeSession';
import type { VerificationResultSummary } from '../types/api';
import {
  CheckCircle2,
  KeyRound,
  Radio,
  Shield,
  ShieldCheck,
} from 'lucide-react';

export function VerificationView({
  realtime,
  onStartVerification,
}: {
  realtime: UseRealtimeSessionReturn;
  onStartVerification: () => void;
}) {
  const [signatureInput, setSignatureInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResultSummary | null>(null);

  const action = SECURITY_ACTION_COPY[realtime.securityAction] || SECURITY_ACTION_COPY.ALLOW;
  const hasSession = Boolean(realtime.session);
  const challenge = realtime.activeChallenge;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge || !signatureInput.trim()) return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const res = await realtime.submitVerification(
        challenge.challenge_token,
        challenge.nonce,
        signatureInput.trim()
      );
      setResult(res);
    } catch (err) {
      setSubmitError((err as Error).message || 'Verification submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Secondary Identity Verification"
        description="Out-of-band cryptographic authentication dispatched when high risk or suspicious voice anomalies are detected."
        badge={
          <span className="rounded-full border border-sky-500/30 bg-sky-950/40 px-3 py-1 font-mono text-xs text-sky-400">
            Out-of-Band (OOB) Challenge Engine
          </span>
        }
      />

      {!hasSession ? (
        <EmptyState
          icon={<Radio className="h-10 w-10 text-slate-500" />}
          title="No Active Voice Session Bound"
          body="Verification challenges are strictly bound to a monitored voice session. Start or select an active session to proceed with verification."
          action={
            <a href={hrefFor('monitor')}>
              <Button variant="primary">Go to Live Monitor</Button>
            </a>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Active Session Context Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-soc-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-slate-100">
                    Session {realtime.session ? shortId(realtime.session.id, 12) : 'Active'}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({realtime.session?.caller_ani || 'No Caller ANI'})
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Current Risk Score: {Math.round(realtime.riskScore)} / 100
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <RiskBadge tier={realtime.riskTier} size="md" />
              <TrustBadge state={realtime.trustState} />
            </div>
          </div>

          {/* Step Progression Flow */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Step 1: Policy Requirement */}
            <Panel className={`flex flex-col justify-between ${!challenge ? 'border-sky-500/40' : ''}`}>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Step 1</span>
                <h3 className="mt-1 text-base font-bold text-slate-100">Security Trigger</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {action.title}: {action.body}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800">
                <Button
                  size="sm"
                  variant="primary"
                  className="w-full"
                  disabled={Boolean(challenge)}
                  onClick={onStartVerification}
                >
                  <KeyRound className="h-4 w-4 mr-1.5" />
                  {challenge ? 'Challenge Dispatched' : 'Dispatch Challenge'}
                </Button>
              </div>
            </Panel>

            {/* Step 2: Nonce Authentication */}
            <Panel className={`flex flex-col justify-between ${challenge && !result ? 'border-sky-500/40' : ''}`}>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Step 2</span>
                <h3 className="mt-1 text-base font-bold text-slate-100">OOB Challenge</h3>
                {challenge ? (
                  <div className="mt-2 space-y-2 font-mono">
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-center">
                      <span className="text-[10px] text-slate-400 block">Challenge Nonce</span>
                      <span className="text-xl font-bold tracking-widest text-sky-400">
                        {challenge.nonce}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">{challenge.instructions}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">Awaiting dispatch trigger from Step 1.</p>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-center">
                <span className="font-mono text-xs text-slate-400">
                  {challenge ? `TTL: ${challenge.ttl_seconds}s Window` : 'Inactive'}
                </span>
              </div>
            </Panel>

            {/* Step 3: Cryptographic Confirmation */}
            <Panel className={`flex flex-col justify-between ${result?.status === 'SUCCESS' ? 'border-emerald-500/40' : ''}`}>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Step 3</span>
                <h3 className="mt-1 text-base font-bold text-slate-100">Verification Result</h3>
                {result?.status === 'SUCCESS' ? (
                  <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-3 text-emerald-300">
                    <CheckCircle2 className="h-5 w-5 mb-1" />
                    <p className="font-bold text-xs">Confirmed by Backend</p>
                    <p className="text-[11px] opacity-80 mt-0.5">Trust restored in state machine.</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    Verification state is confirmed strictly by the TrueVoice backend.
                  </p>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-center">
                <span className="font-mono text-xs text-slate-400">
                  {result?.status === 'SUCCESS' ? 'Verified Authentic' : 'Pending Response'}
                </span>
              </div>
            </Panel>
          </div>

          {/* Interactive Response Form if Challenge is Active */}
          {challenge && (!result || result.status !== 'SUCCESS') ? (
            <Panel className="border-sky-500/40 bg-slate-900 shadow-glow-cyan">
              <SectionTitle
                title="Submit Verification Response"
                description="Input the one-time passcode (OTP) or challenge signature received out-of-band by the caller."
              />
              {submitError ? (
                <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-300">
                  {submitError}
                </div>
              ) : null}
              <form onSubmit={handleVerify} className="space-y-4 max-w-md">
                <div>
                  <label htmlFor="oob-token-input" className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Enter Verification Code or Nonce Copy:
                  </label>
                  <input
                    id="oob-token-input"
                    type="text"
                    value={signatureInput}
                    onChange={(e) => setSignatureInput(e.target.value)}
                    placeholder="e.g., 482910"
                    disabled={isSubmitting}
                    className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={isSubmitting || !signatureInput.trim()}>
                    {isSubmitting ? 'Verifying with Backend…' : 'Submit & Restore Trust'}
                  </Button>
                </div>
              </form>
            </Panel>
          ) : null}

          {/* Success Summary */}
          {result?.status === 'SUCCESS' ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-6 text-center space-y-2">
              <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-bold text-emerald-200">Session Verified Successfully</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {result.message}. Cryptographic audit event has been sealed onto the tamper-evident ledger.
              </p>
              <div className="pt-3">
                <a href={hrefFor('monitor')}>
                  <Button variant="secondary" size="sm">
                    Return to Live Monitor →
                  </Button>
                </a>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
