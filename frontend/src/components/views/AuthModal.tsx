import React, { useState } from 'react';
import { UserPersona } from '../../types';
import { api, ApiError } from '../../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: UserPersona[];
  currentPersona: UserPersona;
  onSelectPersona: (persona: UserPersona) => void;
  onLoginSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  personas,
  currentPersona,
  onSelectPersona,
  onLoginSuccess,
}) => {
  const [tab, setTab] = useState<'persona' | 'login'>('login');
  const [email, setEmail] = useState<string>('analyst@truevoice.com');
  const [password, setPassword] = useState<string>('AuditPassword123!');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRealLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setAuthSuccess(null);
      const res = await api.login({ email, password });
      setAuthSuccess(`Authenticated as ${res.role} (Org: ${res.org_id.slice(0, 8)}...)`);
      if (onLoginSuccess) onLoginSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      setAuthError(msg || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#18181B]/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#EAEAE5] rounded-2xl p-6 shadow-soft-lg animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#EAEAE5] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFF7ED] border border-[#FFEDD5] text-[#EA580C] flex items-center justify-center shadow-soft-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#18181B] font-mono">
                Operator Persona & Access Control
              </h3>
              <p className="text-[11px] text-[#71717A] font-mono">
                Enterprise Zero-Trust Session Management
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white hover:bg-[#F4F4F0] border border-[#E4E4DF] text-[#71717A] transition-colors shadow-soft-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#EAEAE5] mb-5 font-mono text-xs">
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`flex-1 py-2 text-center border-b-2 font-semibold transition-colors ${
              tab === 'login'
                ? 'border-[#EA580C] text-[#EA580C]'
                : 'border-transparent text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            🔐 Real Backend Auth
          </button>
          <button
            type="button"
            onClick={() => setTab('persona')}
            className={`flex-1 py-2 text-center border-b-2 font-semibold transition-colors ${
              tab === 'persona'
                ? 'border-[#EA580C] text-[#EA580C]'
                : 'border-transparent text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            👤 Persona Simulation
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleRealLogin} className="space-y-4 mb-2 font-mono text-xs">
            {authError && (
              <div className="p-3 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-[#BE123C]">
                ⚠️ {authError}
              </div>
            )}
            {authSuccess && (
              <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46]">
                ✅ {authSuccess}
              </div>
            )}

            <div>
              <label className="block text-[#52525B] mb-1 font-semibold">Analyst Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-[#E4E4DF] rounded-xl px-3 py-2 text-[#18181B] focus:outline-none focus:border-[#EA580C]"
                required
              />
            </div>

            <div>
              <label className="block text-[#52525B] mb-1 font-semibold">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-[#E4E4DF] rounded-xl px-3 py-2 text-[#18181B] focus:outline-none focus:border-[#EA580C]"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-soft"
              >
                {isSubmitting ? 'Authenticating...' : 'Sign In with JWT Bearer Token'}
              </button>
            </div>
          </form>
        ) : (
          /* Persona Options */
          <div className="space-y-3 mb-6">
            <p className="text-xs text-[#71717A] mb-2 font-sans">
              Select an authorized security persona to simulate role-based authorization:
            </p>

            {personas.map((persona) => {
              const isSelected = persona.id === currentPersona.id;
              return (
                <div
                  key={persona.id}
                  onClick={() => {
                    onSelectPersona(persona);
                    onClose();
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-soft-sm ${
                    isSelected
                      ? 'bg-[#FFF7ED] border-[#EA580C] ring-2 ring-[#EA580C]/20'
                      : 'bg-white border-[#EAEAE5] hover:border-[#D4D4D0] hover:bg-[#F9F9F7]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl font-mono text-xs font-bold flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#EA580C] text-white shadow-soft-sm'
                        : 'bg-[#F4F4F0] text-[#52525B] border border-[#E4E4DF]'
                    }`}>
                      {persona.avatar}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#18181B] font-sans">
                        {persona.name}
                      </div>
                      <div className="text-[11px] text-[#71717A] font-mono">
                        {persona.role}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-mono text-[#52525B] bg-[#F4F4F0] px-2 py-0.5 rounded border border-[#E4E4DF]">
                      {persona.badge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SSO Simulation Footer */}
        <div className="pt-4 border-t border-[#EAEAE5]">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-white hover:bg-[#F4F4F0] border border-[#E4E4DF] text-[#71717A] font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-soft-sm"
          >
            Close Dialog
          </button>
        </div>
      </div>
    </div>
  );
};

