import { useEffect, useState } from 'react';
import type { ChallengeResponse, VerificationResultSummary } from '../types/api';
import { Button } from './ui/primitives';

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

  const timerPercent = Math.max(0, Math.min(100, (remainingSeconds / (challenge.ttl_seconds || 30)) * 100));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      data-testid="challenge-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="challenge-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-line bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h2 id="challenge-title" className="text-base font-semibold">
              Verification required
            </h2>
            <p className="text-xs text-mute">Out-of-band challenge from the backend</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md px-2 text-mute hover:bg-canvas">
            ×
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-mute">Challenge validity</span>
              <span className={remainingSeconds <= 5 ? 'font-semibold text-crit' : 'text-ink'}>
                {remainingSeconds}s remaining
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full ${remainingSeconds <= 5 ? 'bg-crit' : 'bg-brand'}`}
                style={{ width: `${timerPercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-md bg-canvas px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-mute">Challenge nonce</p>
            <code className="mt-1 block text-2xl font-semibold tracking-widest">{challenge.nonce}</code>
            <p className="mt-2 text-xs text-mute">{challenge.instructions}</p>
          </div>

          {resultSummary ? (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                resultSummary.status === 'SUCCESS' ? 'bg-emerald-50 text-low' : 'bg-red-50 text-crit'
              }`}
            >
              <strong>{resultSummary.status}:</strong> {resultSummary.message}
            </div>
          ) : null}
          {errorMsg ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-crit">{errorMsg}</div> : null}

          {!resultSummary || resultSummary.status !== 'SUCCESS' ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="sig-input" className="mb-1 block text-sm font-medium">
                  Enter Received OTP / Biometric Token:
                </label>
                <input
                  id="sig-input"
                  type="text"
                  className="h-10 w-full rounded-md border border-line px-3 text-sm"
                  placeholder="e.g., OTP code or nonce copy"
                  value={signatureInput}
                  onChange={(e) => setSignatureInput(e.target.value)}
                  disabled={isSubmitting || remainingSeconds === 0}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting || remainingSeconds === 0}>
                  {isSubmitting ? 'Verifying...' : 'Submit Verification'}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm">Verification confirmed by the backend.</p>
          )}
        </div>
      </div>
    </div>
  );
}
