import { useEffect, useState } from 'react';
import type { ChallengeResponse, VerificationResultSummary } from '../types/api';
import { Button } from './ui/primitives';
import { ShieldCheck, ShieldAlert, KeyRound, Clock } from 'lucide-react';

export interface ChallengeModalProps {
  challenge: ChallengeResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitVerification: (
    challengeToken: string,
    nonce: string,
    signature: string
  ) => Promise<VerificationResultSummary>;
}

export function ChallengeModal({
  challenge,
  isOpen,
  onClose,
  onSubmitVerification,
}: ChallengeModalProps) {
  const [signatureInput, setSignatureInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<VerificationResultSummary | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(30);

  useEffect(() => {
    if (!isOpen || !challenge) {
      setSignatureInput('');
      setErrorMsg(null);
      setResultSummary(null);
      return;
    }

    const targetTime = new Date(challenge.expires_at).getTime();
    const updateTimer = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((targetTime - Date.now()) / 1000)));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, challenge]);

  if (!isOpen || !challenge) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureInput.trim()) {
      setErrorMsg('Please enter verification code or signature');
      return;
    }
    if (remainingSeconds <= 0) {
      setErrorMsg('Challenge has expired. Please request a new verification challenge.');
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const res = await onSubmitVerification(
        challenge.challenge_token,
        challenge.nonce,
        signatureInput.trim()
      );
      setResultSummary(res);
      if (res.status === 'SUCCESS') {
        setTimeout(() => onClose(), 1800);
      }
    } catch (err) {
      setErrorMsg((err as Error).message || 'Verification submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ttl = challenge.ttl_seconds || 30;
  const timerPercent = Math.max(0, Math.min(100, (remainingSeconds / ttl) * 100));
  const isUrgent = remainingSeconds <= 5;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fadeIn"
      data-testid="challenge-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="challenge-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <KeyRound className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="challenge-title" className="text-base font-bold text-slate-100">
                Verification Required
              </h2>
              <p className="text-xs text-slate-400">Out-of-band challenge dispatched by TrueVoice backend</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Validity Countdown Progress Bar */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                Challenge validity
              </span>
              <span className={isUrgent ? 'font-bold text-rose-400 animate-pulse' : 'text-sky-300 font-medium'}>
                {remainingSeconds}s remaining
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
              <div
                className={`h-full transition-all duration-1000 ${
                  isUrgent ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-sky-500'
                }`}
                style={{ width: `${timerPercent}%` }}
              />
            </div>
          </div>

          {/* Cryptographic Challenge Nonce Box */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-center shadow-inner">
            <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
              Challenge Nonce Code
            </span>
            <code className="my-1.5 block font-mono text-3xl font-extrabold tracking-[0.25em] text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.3)]">
              {challenge.nonce}
            </code>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              {challenge.instructions}
            </p>
          </div>

          {/* Verification Result Feedback */}
          {resultSummary ? (
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm ${
                resultSummary.status === 'SUCCESS'
                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                  : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
              }`}
            >
              {resultSummary.status === 'SUCCESS' ? (
                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">
                  SUCCESS: {resultSummary.message}
                </p>
                <p className="text-xs text-emerald-300/80 mt-0.5">Trust state restored on backend ledger.</p>
              </div>
            </div>
          ) : null}

          {errorMsg ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300">
              {errorMsg}
            </div>
          ) : null}

          {/* Response Form */}
          {!resultSummary || resultSummary.status !== 'SUCCESS' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="sig-input" className="mb-1.5 block text-xs font-medium text-slate-300">
                  Enter Received OTP / Biometric Token:
                </label>
                <input
                  id="sig-input"
                  type="text"
                  className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  placeholder="e.g., OTP code or nonce copy"
                  value={signatureInput}
                  onChange={(e) => setSignatureInput(e.target.value)}
                  disabled={isSubmitting || remainingSeconds === 0}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-1">
                <Button onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || remainingSeconds === 0}
                >
                  {isSubmitting ? 'Verifying...' : 'Submit Verification'}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-center font-mono text-xs text-emerald-400">
              Verification confirmed by TrueVoice backend. Window closing...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
