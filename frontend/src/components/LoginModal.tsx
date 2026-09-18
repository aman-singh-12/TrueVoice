/**
 * TrueVoice SOC Analyst Login Modal.
 * Authenticates user via POST /v1/auth/login to acquire tenant-scoped Bearer JWT.
 */

import React, { useState } from 'react';
import { api, ApiError } from '../services/api';
import type { TokenResponse } from '../types/api';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: TokenResponse) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('analyst@example.com');
  const [password, setPassword] = useState('Password123!');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await api.login({ email, password });
      onLoginSuccess(res);
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      setErrorMsg(msg || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" data-testid="login-modal">
      <div className="modal-dialog login-dialog">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">🔐</span>
            <div>
              <h2 className="modal-title">SOC ANALYST LOGIN</h2>
              <p className="modal-subtitle">Authenticate with your TrueVoice organizational account</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {errorMsg && <div className="result-alert error">⚠️ {errorMsg}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">
                Analyst Email Address:
              </label>
              <input
                id="login-email"
                type="email"
                className="text-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password" className="form-label">
                Password:
              </label>
              <input
                id="login-password"
                type="password"
                className="text-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Authenticating...' : 'Sign In to Console'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
