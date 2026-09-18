/**
 * TrueVoice Secondary Verification Challenge Modal.
 * Renders high-entropy cryptographic challenge, countdown timer (30s TTL),
 * and executes verification submission against POST /v1/verification/verify.
 * STRICT: NEVER simulates verification success locally. Always delegates to backend API.
 */

import React, { useState, useEffect } from 'react';
import type { ChallengeResponse, VerificationResultSummary } from '../types/api';

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

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  challenge,
  isOpen,
  onClose,
  onSubmitVerification,
}) => {
  const [signatureInput, setSignatureInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<VerificationResultSummary | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(30);

  // Compute countdown timer
  useEffect(() => {
    if (!isOpen || !challenge) {
      setSignatureInput('');
      setErrorMsg(null);
      setResultSummary(null);
      return;
    }

    const targetTime = new Date(challenge.expires_at).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.ceil((targetTime - now) / 1000));
      setRemainingSeconds(diffSec);
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
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err) {
      setErrorMsg((err as Error).message || 'Verification submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const timerPercent = Math.max(0, Math.min(100, (remainingSeconds / (challenge.ttl_seconds || 30)) * 100));

  return (
    <div className="modal-backdrop" data-testid="challenge-modal">
      <div className="modal-dialog">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">🔐</span>
            <div>
              <h2 className="modal-title">SECONDARY VERIFICATION REQUIRED</h2>
              <p className="modal-subtitle">Out-of-Band (OOB) Cryptographic Challenge</p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* TTL Countdown Bar */}
          <div className="ttl-bar-wrapper">
            <div className="ttl-meta">
              <span className="ttl-label">Challenge Validity</span>
              <span className={`ttl-seconds ${remainingSeconds <= 5 ? 'urgent' : ''}`}>
                {remainingSeconds}s remaining
              </span>
            </div>
            <div className="ttl-track">
              <div
                className={`ttl-fill ${remainingSeconds <= 5 ? 'urgent' : ''}`}
                style={{ width: `${timerPercent}%` }}
              />
            </div>
          </div>

          {/* Nonce Card */}
          <div className="nonce-card">
            <span className="nonce-label">CHALLENGE NONCE</span>
            <div className="nonce-display">
              <code>{challenge.nonce}</code>
            </div>
            <p className="nonce-instructions">{challenge.instructions}</p>
          </div>

          {/* Result Alert if available */}
          {resultSummary && (
            <div
              className={`result-alert ${resultSummary.status === 'SUCCESS' ? 'success' : 'error'}`}
            >
              {resultSummary.status === 'SUCCESS' ? '✅' : '❌'}{' '}
              <strong>{resultSummary.status}:</strong> {resultSummary.message}
            </div>
          )}

          {errorMsg && <div className="result-alert error">⚠️ {errorMsg}</div>}

          {/* Input Form */}
          {!resultSummary || resultSummary.status !== 'SUCCESS' ? (
            <form onSubmit={handleSubmit} className="verification-form">
              <div className="form-group">
                <label htmlFor="sig-input" className="form-label">
                  Enter Received OTP / Biometric Token:
                </label>
                <input
                  id="sig-input"
                  type="text"
                  className="text-input"
                  placeholder="e.g., OTP code or nonce copy"
                  value={signatureInput}
                  onChange={(e) => setSignatureInput(e.target.value)}
                  disabled={isSubmitting || remainingSeconds === 0}
                  autoFocus
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || remainingSeconds === 0}
                >
                  {isSubmitting ? 'Verifying...' : 'Submit Verification'}
                </button>
              </div>
            </form>
          ) : (
            <div className="verified-success-message">
              <p>Session trust state upgraded to <strong>TRUSTED</strong>.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
