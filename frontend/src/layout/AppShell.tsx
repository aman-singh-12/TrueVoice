import { useState, type ReactNode } from 'react';
import {
  Activity,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  Radio,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
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

const NAV: { group: string; items: { name: RouteName; label: string; icon: typeof Radio }[] }[] = [
  {
    group: 'Monitor',
    items: [
      { name: 'overview', label: 'Overview', icon: LayoutDashboard },
      { name: 'monitor', label: 'Live Monitor', icon: Radio },
    ],
  },
  {
    group: 'Investigate',
    items: [
      { name: 'sessions', label: 'Sessions', icon: Activity },
      { name: 'incidents', label: 'Incidents', icon: ShieldAlert },
    ],
  },
  {
    group: 'Security',
    items: [
      { name: 'verification', label: 'Verification', icon: ShieldCheck },
      { name: 'audit', label: 'Audit', icon: ScrollText },
    ],
  },
];

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

  const monitorTone = monitoring ? 'ok' : streamStatus === 'ERROR' ? 'danger' : 'neutral';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-950 text-slate-200 transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-800 text-sky-200">
            <Radio className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">TrueVoice</p>
            <p className="text-[11px] text-slate-400">Voice security</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
          {NAV.map((section) => (
            <div key={section.group} className="mb-5">
              <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {section.group}
              </p>
              <ul className="space-y-0.5">
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
                          'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400',
                          active
                            ? 'bg-white/10 text-white'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <a
            href={hrefFor('settings')}
            className={cn(
              'mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
              route.name === 'settings' ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'
            )}
          >
            <Settings className="h-4 w-4" aria-hidden />
            Settings
          </a>
          <a
            href={hrefFor('help')}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
              route.name === 'help' ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'
            )}
          >
            <HelpCircle className="h-4 w-4" aria-hidden />
            Help
          </a>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur">
          <button
            type="button"
            className="rounded-md p-2 text-mute hover:bg-canvas lg:hidden"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <ClipboardList className="h-5 w-5" />
          </button>

          <form
            className="min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit(query.trim());
            }}
          >
            <label htmlFor="global-search" className="sr-only">
              Search sessions
            </label>
            <input
              id="global-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions"
              className="h-9 w-full max-w-md rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-700 focus:outline-none"
            />
          </form>

          <StatusDot tone={monitorTone} label={connectionLabel(streamStatus, monitoring)} />

          <a
            href={hrefFor('incidents')}
            className="relative rounded-md px-2 py-1 text-sm text-mute hover:bg-canvas hover:text-ink"
          >
            Alerts
            {alertCount > 0 ? (
              <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-crit px-1.5 text-[11px] font-semibold text-white">
                {alertCount}
              </span>
            ) : null}
          </a>

          <div className="hidden items-center gap-2 sm:flex">
            <div className="text-right">
              <p className="text-xs font-medium text-ink">{user?.role?.replace(/_/g, ' ') || 'Analyst'}</p>
              <p className="text-[11px] text-mute">{user?.user_id ? user.user_id.slice(0, 8) : 'Signed in'}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs text-mute hover:bg-canvas"
            >
              Sign out
            </button>
          </div>
        </header>

        <main id="main-content" className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
