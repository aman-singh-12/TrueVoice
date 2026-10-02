import { useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  FileAudio,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Radio,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { hrefFor, type AppRoute, type RouteName } from '../lib/routing';
import type { TokenResponse } from '../types/api';
import type { StreamConnectionStatus } from '../services/TrueVoiceStreamClient';
import { StatusDot } from '../components/ui/badges';
import { connectionLabel } from '../lib/format';

interface AppShellProps {
  route: AppRoute;
  user: TokenResponse | null;
  monitoring: boolean;
  streamStatus: StreamConnectionStatus;
  alertCount: number;
  search: string;
  onSearchSubmit: (value: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

interface NavGroup {
  group: string;
  items: {
    name: RouteName;
    label: string;
    icon: typeof Radio;
    badge?: number;
  }[];
}

function isActive(route: AppRoute, name: RouteName): boolean {
  if (name === 'sessions') return route.name === 'sessions' || route.name === 'session';
  if (name === 'incidents') return route.name === 'incidents' || route.name === 'incident';
  if (name === 'audit') return route.name === 'audit';
  return route.name === name;
}

export function AppShell({
  route,
  user,
  monitoring,
  streamStatus,
  alertCount,
  search,
  onSearchSubmit,
  onLogout,
  children,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState(search);

  const navGroups: NavGroup[] = [
    {
      group: 'ANALYSIS & MONITORING',
      items: [
        { name: 'overview', label: 'Overview', icon: LayoutDashboard },
        { name: 'analyze', label: 'Analyze Voice', icon: FileAudio },
        { name: 'monitor', label: 'Live Monitor', icon: Radio },
      ],
    },
    {
      group: 'INVESTIGATE',
      items: [
        { name: 'sessions', label: 'Sessions', icon: Activity },
        { name: 'incidents', label: 'Incidents', icon: ShieldAlert, badge: alertCount },
      ],
    },
    {
      group: 'SECURITY',
      items: [
        { name: 'verification', label: 'Verification', icon: ShieldCheck },
        { name: 'audit', label: 'Audit Ledger', icon: ScrollText },
      ],
    },
    {
      group: 'SYSTEM',
      items: [
        { name: 'settings', label: 'Policy & Vault', icon: Settings },
        { name: 'help', label: 'SOC Guide', icon: HelpCircle },
      ],
    },
  ];

  const monitorTone = monitoring ? 'ok' : streamStatus === 'ERROR' ? 'danger' : 'neutral';

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-sky-500 focus:px-4 focus:py-2 focus:text-white focus:shadow-xl font-medium text-sm"
      >
        Skip to main content
      </a>

      {/* Mobile Backdrop */}
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden cursor-default"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Primary Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800/80 bg-[#0c1220] transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-5 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
              <Shield className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-white font-sans">TrueVoice</span>
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-sky-400 border border-sky-500/30">
                  SOC
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">Voice Trust Platform</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Stream Quick Jump Widget in Sidebar if active */}
        {monitoring ? (
          <div className="mx-3 mt-3 rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                STREAM ACTIVE
              </span>
              <a
                href={hrefFor('monitor')}
                onClick={() => setSidebarOpen(false)}
                className="text-[11px] font-mono text-sky-400 hover:underline"
              >
                View Live →
              </a>
            </div>
          </div>
        ) : null}

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Primary Navigation">
          {navGroups.map((section) => (
            <div key={section.group}>
              <p className="mb-2 px-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
                {section.group}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(route, item.name);
                  return (
                    <li key={item.name}>
                      <a
                        href={hrefFor(item.name)}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium tracking-wide transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400',
                          active
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-[0_0_12px_rgba(56,189,248,0.15)] font-semibold'
                            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0 transition-colors',
                              active ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-300'
                            )}
                            aria-hidden
                          />
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && item.badge > 0 ? (
                          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-300 border border-rose-500/40">
                            {item.badge}
                          </span>
                        ) : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: System Diagnostics & Authenticated Identity */}
        <div className="border-t border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center gap-2.5 rounded-lg p-2 bg-slate-900/60 border border-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-slate-300">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-200">
                {user?.role?.replace(/_/g, ' ') || 'SOC Analyst'}
              </p>
              <p className="truncate font-mono text-[10px] text-slate-400">
                {user?.user_id ? `ID: ${user.user_id.slice(0, 8)}` : 'Authenticated'}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-mono text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              title="Sign out of console"
            >
              Exit
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-800/80 bg-[#0a0f1d]/90 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
              aria-label="Open navigation menu"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Global Search Bar */}
            <form
              className="relative w-full max-w-sm hidden sm:block"
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit(query.trim());
              }}
            >
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <label htmlFor="global-search" className="sr-only">
                Search sessions
              </label>
              <input
                id="global-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sessions by ANI or ID..."
                className="h-9 w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </form>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live Connection Status Dot */}
            <div className="hidden xs:flex items-center rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5">
              <StatusDot
                tone={monitorTone}
                label={connectionLabel(streamStatus, monitoring)}
                pulse={monitoring}
              />
            </div>

            {/* Alerts Navigation Action */}
            <a
              href={hrefFor('incidents')}
              className="relative flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:bg-slate-800 transition-colors"
            >
              <AlertTriangle className={cn('h-3.5 w-3.5', alertCount > 0 ? 'text-amber-400' : 'text-slate-400')} />
              <span>Incidents</span>
              {alertCount > 0 ? (
                <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[10px] font-bold text-white shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                  {alertCount}
                </span>
              ) : null}
            </a>

            {/* Live Monitor Quick CTA */}
            <a
              href={hrefFor('monitor')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all',
                monitoring
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'bg-sky-600 hover:bg-sky-500 text-white shadow-[0_0_12px_rgba(2,132,199,0.3)]'
              )}
            >
              <Radio className={cn('h-3.5 w-3.5', monitoring && 'animate-pulse')} />
              <span>{monitoring ? 'Live Stream' : 'Start Monitor'}</span>
            </a>
          </div>
        </header>

        {/* Main Content Area */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
