import { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  User,
  Building2,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  Check,
  X,
  Radio,
} from 'lucide-react';
import { api, ApiError } from '../services/api';
import { Button } from '../components/ui/primitives';
import type { UserRole } from '../types/api';

type AuthMode = 'login' | 'register';

interface RoleOption {
  value: UserRole;
  label: string;
  badge: string;
  description: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'SECURITY_ANALYST',
    label: 'Security Analyst',
    badge: 'SOC TIER 2/3',
    description: 'Real-time telemetry triage, forensic override, and deepfake verification.',
  },
  {
    value: 'ORG_ADMIN',
    label: 'SOC Administrator',
    badge: 'FULL ADMIN',
    description: 'Organizational threshold policy configuration, user & speaker management.',
  },
  {
    value: 'OPERATOR',
    label: 'Voice Operator',
    badge: 'TIER 1 MON',
    description: 'Call session monitoring and live speech verification challenge initiation.',
  },
  {
    value: 'FORENSIC_AUDITOR',
    label: 'Forensic Auditor',
    badge: 'AUDIT / COMPLIANCE',
    description: 'Read-only access to cryptographic SHA-256 hash chains & evidence export.',
  },
];

const DEMO_PRESETS = [
  {
    label: 'Analyst Demo',
    email: 'analyst@truevoice.sec',
    password: 'AnalystPass123!',
    role: 'Security Analyst',
  },
  {
    label: 'SOC Admin Demo',
    email: 'admin@truevoice.sec',
    password: 'AdminPass123!',
    role: 'SOC Admin',
  },
  {
    label: 'Operator Demo',
    email: 'operator@truevoice.sec',
    password: 'OperatorPass123!',
    role: 'Voice Operator',
  },
];

export function LoginView({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register fields
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regOrgName, setRegOrgName] = useState('TrueVoice Security Operations');
  const [regRole, setRegRole] = useState<UserRole>('SECURITY_ANALYST');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // General state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Password strength calculations for registration
  const hasMinLength = regPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(regPassword);
  const hasNumberOrSymbol = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(regPassword);
  const passwordsMatch = regPassword.length > 0 && regPassword === regConfirmPassword;

  let strengthScore = 0;
  if (hasMinLength) strengthScore += 1;
  if (hasLetter) strengthScore += 1;
  if (hasNumberOrSymbol) strengthScore += 1;
  if (regPassword.length >= 12) strengthScore += 1;

  const getStrengthLabel = () => {
    if (!regPassword) return { label: 'Empty', color: 'text-slate-500', bar: 'w-0 bg-slate-700' };
    if (strengthScore <= 1) return { label: 'Weak', color: 'text-rose-400', bar: 'w-1/3 bg-rose-500' };
    if (strengthScore <= 3) return { label: 'Moderate', color: 'text-amber-400', bar: 'w-2/3 bg-amber-500' };
    return { label: 'Strong (SOC Compliant)', color: 'text-emerald-400', bar: 'w-full bg-emerald-500' };
  };

  const strengthInfo = getStrengthLabel();

  const handleApplyPreset = (preset: typeof DEMO_PRESETS[0]) => {
    setMode('login');
    setLoginEmail(preset.email);
    setLoginPassword(preset.password);
    setError(null);
    setSuccessNotice(`Pre-filled credentials for ${preset.label}`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      setSuccessNotice(null);
      await api.login({ email: loginEmail, password: loginPassword });
      onSuccess();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      setError(msg || 'Authentication failed. Please verify credentials or backend connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters in length.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      setSuccessNotice(null);
      await api.register({
        email: regEmail,
        password: regPassword,
        full_name: regFullName,
        role: regRole,
        organization_name: regOrgName || 'TrueVoice Security Operations',
      });
      setSuccessNotice('Account created successfully. Accessing console…');
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      setError(msg || 'Registration failed. Please check your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070b14] px-4 py-10 relative overflow-hidden selection:bg-sky-500/30 selection:text-sky-200">
      {/* Dynamic Background Glow Elements */}
      <div className="absolute top-1/6 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-3/4 left-1/4 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-xl rounded-2xl border border-slate-800/90 bg-slate-900/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Brand & Platform Emblem */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-[0_0_28px_rgba(56,189,248,0.3)]">
            <Shield className="h-7 w-7" aria-hidden />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans">TrueVoice</h1>
            <span className="rounded bg-sky-500/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-sky-400 border border-sky-500/30">
              ENTERPRISE SOC
            </span>
          </div>
          <p className="mt-1 text-xs font-mono text-slate-400">
            Real-Time AI Voice Integrity & Impersonation Prevention
          </p>
        </div>

        {/* Quick Demo Credentials Strip */}
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Quick Demo Logins (1-Click Fill)
            </span>
            <span className="text-[10px] font-mono text-slate-500">Default Test Accounts</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {DEMO_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="flex flex-col items-start rounded-lg border border-slate-800/90 bg-slate-900/90 px-2.5 py-1.5 text-left transition hover:border-sky-500/50 hover:bg-slate-800/80 group"
              >
                <span className="text-xs font-semibold text-slate-200 group-hover:text-sky-300 transition">
                  {p.label}
                </span>
                <span className="text-[10px] font-mono text-slate-400 truncate w-full">
                  {p.email}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Mode Selector Tabs (Sign In vs Create Account) */}
        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-950/80 p-1 border border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold font-mono uppercase tracking-wider transition-all ${
              mode === 'login'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold font-mono uppercase tracking-wider transition-all ${
              mode === 'register'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Create Account
          </button>
        </div>

        {/* Error Notification */}
        {error ? (
          <div
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-950/40 p-3.5 text-xs text-rose-200 shadow-md animate-fadeIn"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        ) : null}

        {/* Success Notice */}
        {successNotice ? (
          <div
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-xs text-emerald-200 shadow-md animate-fadeIn"
            role="status"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{successNotice}</p>
          </div>
        ) : null}

        {/* SIGN IN FORM */}
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-slate-400"
              >
                Analyst Email / Operator ID
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="analyst@truevoice.sec"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-mono uppercase tracking-wider text-slate-400"
                >
                  Operator Access Token / Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-10 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((s) => !s)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full gap-2 font-bold tracking-wide mt-3 bg-sky-600 hover:bg-sky-500 text-white"
              disabled={submitting}
            >
              {submitting ? 'Authenticating Credentials…' : 'Access Security Console'}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        ) : (
          /* CREATE ACCOUNT (REGISTER) FORM */
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="reg-name"
                  className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-slate-400"
                >
                  Full Name / Call Sign
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    id="reg-name"
                    type="text"
                    required
                    placeholder="Sarah Chen"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-slate-400"
                >
                  Analyst Corporate Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    placeholder="analyst@enterprise.sec"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-org"
                className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-slate-400"
              >
                Security Organization / Tenant
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="reg-org"
                  type="text"
                  placeholder="TrueVoice Security Operations"
                  value={regOrgName}
                  onChange={(e) => setRegOrgName(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition"
                />
              </div>
            </div>

            {/* Role Selector */}
            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-slate-400">
                Security Role Assignment
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRegRole(opt.value)}
                    className={`flex flex-col p-2.5 rounded-lg border text-left transition-all ${
                      regRole === opt.value
                        ? 'border-sky-500 bg-sky-950/40 text-white shadow-sm shadow-sky-500/20'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-slate-200">{opt.label}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          regRole === opt.value
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="reg-password"
                  className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-slate-400"
                >
                  Master Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    id="reg-password"
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-10 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((s) => !s)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition"
                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                  >
                    {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-confirm"
                  className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-slate-400"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    id="reg-confirm"
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Password Validation & Strength Meter */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Password Strength:</span>
                <span className={`font-bold ${strengthInfo.color}`}>{strengthInfo.label}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-300 ${strengthInfo.bar}`} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasMinLength ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
                  <span>8+ Characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLetter ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasLetter ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
                  <span>Letters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {passwordsMatch ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
                  <span>Passwords Match</span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full gap-2 font-bold tracking-wide mt-3 bg-sky-600 hover:bg-sky-500 text-white"
              disabled={submitting || !hasMinLength || !passwordsMatch}
            >
              {submitting ? 'Provisioning Account…' : 'Create Account & Access SOC'}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        )}

        {/* Security / Compliance Badges Footer */}
        <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
              <span>Zero-Trust JWT</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <Shield className="h-3 w-3 text-sky-400 shrink-0" />
              <span>Bcrypt / Argon2</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <Radio className="h-3 w-3 text-amber-400 shrink-0" />
              <span>Multi-Tenant RBAC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
