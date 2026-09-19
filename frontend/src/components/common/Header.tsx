import React from 'react';
import { UserPersona } from '../../types';

interface HeaderProps {
  activeTab: 'console' | 'sessions' | 'speakers' | 'audit' | 'policies';
  onTabChange: (tab: 'console' | 'sessions' | 'speakers' | 'audit' | 'policies') => void;
  currentPersona: UserPersona;
  onOpenAuth: () => void;
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  currentPersona,
  onOpenAuth,
  activeScenarioId,
  onSelectScenario,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#EAEAE5] px-6 py-3 transition-colors shadow-soft-sm">
      <div className="max-w-[1720px] mx-auto flex flex-col xl:flex-row items-center justify-between gap-4">
        
        {/* Left: Brand Identity & Active Ingestion Mode */}
        <div className="flex items-center gap-6 w-full xl:w-auto justify-between xl:justify-start">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#FFF7ED] border border-[#FFEDD5] text-[#EA580C] shadow-soft-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#EA580C] animate-ping opacity-75" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-[#18181B] font-sans">
                  TrueVoice
                </span>
                <span className="text-[10px] font-mono uppercase bg-[#F4F4F0] text-[#52525B] border border-[#E4E4DF] px-1.5 py-0.2 rounded font-semibold tracking-wider">
                  ENTERPRISE v2.4
                </span>
              </div>
              <p className="text-[11px] text-[#71717A] font-mono tracking-wide">
                AI Voice Cloning Detection & Impersonation Defense
              </p>
            </div>
          </div>

          {/* Persistent Mode Indicator Chip */}
          <div className="hidden md:flex items-center gap-2.5 bg-[#F8F8F6] border border-[#EAEAE5] rounded-full px-3.5 py-1 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-[#047857] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              Mode: File Ingestion (Active)
            </span>
            <span className="text-[#D4D4D0]">|</span>
            <span className="text-[#71717A]">
              Live Telephony SIP Stream: <span className="text-[#A1A1AA]">Planned (V2)</span>
            </span>
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#F4F4F0] p-1 rounded-xl border border-[#EAEAE5]">
          <button
            onClick={() => onTabChange('console')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'console'
                ? 'bg-white text-[#18181B] border border-[#EAEAE5] shadow-soft font-semibold'
                : 'text-[#71717A] hover:text-[#18181B] hover:bg-white/60'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Forensics Console
          </button>

          <button
            onClick={() => onTabChange('sessions')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'sessions'
                ? 'bg-white text-[#18181B] border border-[#EAEAE5] shadow-soft font-semibold'
                : 'text-[#71717A] hover:text-[#18181B] hover:bg-white/60'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            Incident Sessions
          </button>

          <button
            onClick={() => onTabChange('speakers')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'speakers'
                ? 'bg-white text-[#18181B] border border-[#EAEAE5] shadow-soft font-semibold'
                : 'text-[#71717A] hover:text-[#18181B] hover:bg-white/60'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Biometrics Vault
          </button>

          <button
            onClick={() => onTabChange('audit')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-white text-[#18181B] border border-[#EAEAE5] shadow-soft font-semibold'
                : 'text-[#71717A] hover:text-[#18181B] hover:bg-white/60'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Audit Ledger
          </button>

          <button
            onClick={() => onTabChange('policies')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'policies'
                ? 'bg-white text-[#18181B] border border-[#EAEAE5] shadow-soft font-semibold'
                : 'text-[#71717A] hover:text-[#18181B] hover:bg-white/60'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Policy Tuning
          </button>
        </nav>

        {/* Right: Quick Scenario Presets + Persona */}
        <div className="flex items-center gap-3">
          {/* Quick Scenario Toggles */}
          <div className="flex items-center bg-[#F4F4F0] border border-[#EAEAE5] rounded-xl p-1 text-xs">
            <button
              onClick={() => onSelectScenario('attack')}
              className={`px-2.5 py-1 rounded-lg transition-all font-mono font-medium flex items-center gap-1.5 ${
                activeScenarioId === 'attack'
                  ? 'bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3] shadow-soft-sm font-semibold'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
              title="Switch to Deepfake Escrow Attack (Critical Risk 88.4%)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#BE123C]" />
              Escrow Attack (88%)
            </button>
            <button
              onClick={() => onSelectScenario('authentic')}
              className={`px-2.5 py-1 rounded-lg transition-all font-mono font-medium flex items-center gap-1.5 ${
                activeScenarioId === 'authentic'
                  ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] shadow-soft-sm font-semibold'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
              title="Switch to Authentic Executive Call (Low Risk 11.6%)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#047857]" />
              Authentic (12%)
            </button>
            <button
              onClick={() => onSelectScenario('borderline')}
              className={`px-2.5 py-1 rounded-lg transition-all font-mono font-medium flex items-center gap-1.5 ${
                activeScenarioId === 'borderline'
                  ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] shadow-soft-sm font-semibold'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
              title="Switch to Borderline Telephony Jitter (Caution 54.2%)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#B45309]" />
              Borderline (54%)
            </button>
          </div>

          {/* User Persona Profile Pill */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2.5 bg-white border border-[#EAEAE5] hover:border-[#D4D4D0] rounded-xl px-3 py-1.5 transition-all group text-left shadow-soft-sm"
            title="Switch User Persona or Sign Out"
          >
            <div className="w-7 h-7 rounded-lg bg-[#FFF7ED] border border-[#FFEDD5] text-[#EA580C] font-mono text-xs font-bold flex items-center justify-center group-hover:scale-105 transition-transform">
              {currentPersona.avatar}
            </div>
            <div className="hidden lg:block">
              <div className="text-xs font-medium text-[#18181B] group-hover:text-[#EA580C] transition-colors leading-none mb-1">
                {currentPersona.name}
              </div>
              <div className="text-[10px] font-mono text-[#71717A] leading-none">
                {currentPersona.role}
              </div>
            </div>
            <svg className="w-3.5 h-3.5 text-[#A1A1AA] group-hover:text-[#EA580C] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

      </div>
    </header>
  );
};
