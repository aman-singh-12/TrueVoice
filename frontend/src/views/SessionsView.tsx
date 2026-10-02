import { useMemo, useState } from 'react';
import { hrefFor } from '../lib/routing';
import { elapsedSeconds, formatClock, formatTimestamp, isActiveSession, roundScore } from '../lib/format';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives';
import { TrustBadge } from '../components/ui/badges';
import { useSessions } from '../hooks/useSessions';
import type { SessionResponse } from '../types/api';
import { Activity, ArrowUpDown, Filter, ShieldAlert } from 'lucide-react';

type SortKey = 'started_at' | 'peak_risk_score' | 'caller_ani';

export function SessionsView({ query, incidentOnly }: { query: string; incidentOnly?: boolean }) {
  const { sessions, loading, error, refresh } = useSessions();
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'ENDED'>('ALL');
  const [trust, setTrust] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('started_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const rows = useMemo(() => {
    let list = [...sessions];
    if (incidentOnly) {
      list = list.filter((s) =>
        ['CAUTION', 'VERIFYING', 'RESTRICTED', 'BLOCKED', 'HUMAN_REVIEW'].includes(s.current_trust_state)
      );
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          (s.caller_ani || '').toLowerCase().includes(q) ||
          (s.claimed_speaker_id || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'ACTIVE') list = list.filter(isActiveSession);
    if (filter === 'ENDED') list = list.filter((s) => !isActiveSession(s));
    if (trust !== 'ALL') list = list.filter((s) => s.current_trust_state === trust);
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'peak_risk_score') return (a.peak_risk_score - b.peak_risk_score) * dir;
      if (sortKey === 'caller_ani') return (a.caller_ani || '').localeCompare(b.caller_ani || '') * dir;
      return (new Date(a.started_at).getTime() - new Date(b.started_at).getTime()) * dir;
    });
    return list;
  }, [sessions, incidentOnly, query, filter, trust, sortKey, sortDir]);

  const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={incidentOnly ? 'Security Incidents' : 'Voice Sessions'}
        description={
          incidentOnly
            ? 'Triage of suspicious or high-risk voice streams placed under caution, restriction, or block.'
            : 'Complete historical repository of voice interactions monitored and evaluated by TrueVoice.'
        }
        badge={
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs text-slate-300">
            {rows.length} {incidentOnly ? 'Incidents' : 'Sessions'}
          </span>
        }
        actions={
          <Button size="sm" onClick={() => void refresh()}>
            Refresh List
          </Button>
        }
      />

      {/* Filter and Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-3 shadow-soc-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 pl-2">
            <Filter className="h-3.5 w-3.5 text-sky-400" />
            <span>Filters:</span>
          </div>
          <select
            aria-label="Status filter"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter);
              setPage(0);
            }}
            className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Streams</option>
            <option value="ENDED">Ended Calls</option>
          </select>

          <select
            aria-label="Trust filter"
            value={trust}
            onChange={(e) => {
              setTrust(e.target.value);
              setPage(0);
            }}
            className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            <option value="ALL">All Trust States</option>
            {['OBSERVING', 'CAUTION', 'VERIFYING', 'TRUSTED', 'RESTRICTED', 'BLOCKED', 'HUMAN_REVIEW', 'TERMINATED'].map(
              (t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              )
            )}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>Sort By:</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggleSort('started_at')}
            className={sortKey === 'started_at' ? 'text-sky-400 font-bold' : ''}
          >
            Date <ArrowUpDown className="h-3 w-3 ml-1" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggleSort('peak_risk_score')}
            className={sortKey === 'peak_risk_score' ? 'text-sky-400 font-bold' : ''}
          >
            Risk <ArrowUpDown className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>

      {error ? <ErrorState title="Unable to retrieve records" body={error} onRetry={refresh} /> : null}
      {loading ? <Skeleton className="h-72 w-full" /> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={incidentOnly ? <ShieldAlert className="h-10 w-10 text-slate-500" /> : <Activity className="h-10 w-10 text-slate-500" />}
          title={incidentOnly ? 'No Active Incidents' : 'No Recorded Sessions'}
          body={
            incidentOnly
              ? 'No voice sessions are currently flagged with caution, verification, or restricted states.'
              : 'Start a voice monitoring stream to generate real-time telemetry.'
          }
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-soc-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-slate-800 bg-slate-950/80 uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3.5 font-bold">Session & Identity</th>
                  <th className="px-5 py-3.5 font-bold">Date & Time</th>
                  <th className="px-5 py-3.5 font-bold">Duration</th>
                  <th className="px-5 py-3.5 font-bold">Peak Risk</th>
                  <th className="px-5 py-3.5 font-bold">Trust State</th>
                  <th className="px-5 py-3.5 font-bold">Channel</th>
                  <th className="px-5 py-3.5 font-bold text-right">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pageRows.map((s) => (
                  <SessionTableRow key={s.id} session={s} incidentOnly={incidentOnly} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {rows.length > pageSize ? (
            <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-xs font-mono text-slate-400 bg-slate-950/40">
              <span>
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)} of {rows.length}
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span>
                  Page {page + 1} / {Math.ceil(rows.length / pageSize)}
                </span>
                <Button
                  size="sm"
                  disabled={(page + 1) * pageSize >= rows.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SessionTableRow({ session, incidentOnly }: { session: SessionResponse; incidentOnly?: boolean }) {
  const active = isActiveSession(session);
  const href = incidentOnly ? hrefFor('incident', session.id) : hrefFor('session', session.id);
  const peak = roundScore(session.peak_risk_score);
  const isHighRisk = peak !== null && peak >= 60;

  return (
    <tr className="hover:bg-slate-800/50 transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <a href={href} className="font-bold text-sky-400 hover:text-sky-300 hover:underline">
            {session.caller_ani || 'Unknown Identity'}
          </a>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            {session.id.slice(0, 8)}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{session.id}</p>
      </td>
      <td className="px-5 py-3.5 text-slate-300 font-sans">{formatTimestamp(session.started_at)}</td>
      <td className="px-5 py-3.5 tabular-nums text-slate-300 font-mono">
        {formatClock(elapsedSeconds(session.started_at, session.ended_at))}
      </td>
      <td className="px-5 py-3.5 tabular-nums">
        <span
          className={`font-bold text-sm ${
            isHighRisk ? 'text-rose-400' : peak !== null && peak >= 30 ? 'text-amber-400' : 'text-emerald-400'
          }`}
        >
          {peak ?? '—'}
        </span>
        <span className="text-slate-400 text-[10px] ml-1">/ 100</span>
      </td>
      <td className="px-5 py-3.5">
        <TrustBadge state={session.current_trust_state} />
      </td>
      <td className="px-5 py-3.5">
        {active ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            Live
          </span>
        ) : (
          <span className="text-slate-400">Completed</span>
        )}
      </td>
      <td className="px-5 py-3.5 text-right">
        <a
          href={href}
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:border-sky-500 hover:bg-sky-500/20 hover:text-sky-300 transition-colors"
        >
          Inspect →
        </a>
      </td>
    </tr>
  );
}
