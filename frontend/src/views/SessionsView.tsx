import { useMemo, useState } from 'react';
import { hrefFor } from '../lib/routing';
import { elapsedSeconds, formatClock, formatTimestamp, isActiveSession, roundScore } from '../lib/format';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives';
import { TrustBadge } from '../components/ui/badges';
import { useSessions } from '../hooks/useSessions';
import type { SessionResponse } from '../types/api';

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
    <div>
      <PageHeader
        title={incidentOnly ? 'Incidents' : 'Sessions'}
        description={
          incidentOnly
            ? 'Sessions in a caution, verification, restricted, blocked, or review state.'
            : 'Monitored voice sessions from the backend.'
        }
        actions={
          <Button size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          aria-label="Status filter"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as typeof filter);
            setPage(0);
          }}
          className="h-9 rounded-md border border-line bg-white px-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ENDED">Ended</option>
        </select>
        <select
          aria-label="Trust filter"
          value={trust}
          onChange={(e) => {
            setTrust(e.target.value);
            setPage(0);
          }}
          className="h-9 rounded-md border border-line bg-white px-2 text-sm"
        >
          <option value="ALL">All trust states</option>
          {['OBSERVING', 'CAUTION', 'VERIFYING', 'TRUSTED', 'RESTRICTED', 'BLOCKED', 'HUMAN_REVIEW', 'TERMINATED'].map(
            (t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            )
          )}
        </select>
      </div>

      {error ? <ErrorState title="Unable to load sessions" body={error} onRetry={refresh} /> : null}
      {loading ? <Skeleton className="h-64 w-full" /> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState
          title={incidentOnly ? 'No active incidents' : 'No sessions yet'}
          body={incidentOnly ? 'Incidents appear when backend trust state requires attention.' : 'Start live monitoring to create a session.'}
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs text-mute">
              <tr>
                <th className="px-4 py-3 font-medium">Session</th>
                <th className="px-4 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort('started_at')}>
                    Date
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort('peak_risk_score')}>
                    Peak risk
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Trust</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => (
                <SessionRow key={s.id} session={s} incidentOnly={incidentOnly} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {rows.length > pageSize ? (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-mute">
            Page {page + 1} of {Math.ceil(rows.length / pageSize)}
          </span>
          <Button
            size="sm"
            disabled={(page + 1) * pageSize >= rows.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SessionRow({ session, incidentOnly }: { session: SessionResponse; incidentOnly?: boolean }) {
  const active = isActiveSession(session);
  const href = incidentOnly ? hrefFor('incident', session.id) : hrefFor('session', session.id);
  return (
    <tr className="border-b border-line last:border-0 hover:bg-canvas/60">
      <td className="px-4 py-3">
        <a href={href} className="font-medium text-ink hover:underline">
          {session.caller_ani || session.id.slice(0, 8)}
        </a>
        <p className="font-mono text-[11px] text-mute">{session.id.slice(0, 8)}</p>
      </td>
      <td className="px-4 py-3 text-mute">{formatTimestamp(session.started_at)}</td>
      <td className="px-4 py-3 tabular-nums">
        {formatClock(elapsedSeconds(session.started_at, session.ended_at))}
      </td>
      <td className="px-4 py-3 tabular-nums font-medium">{roundScore(session.peak_risk_score) ?? '—'}</td>
      <td className="px-4 py-3">
        <TrustBadge state={session.current_trust_state} />
      </td>
      <td className="px-4 py-3 text-mute">{active ? 'Active' : 'Ended'}</td>
      <td className="px-4 py-3">
        <a href={href} className="text-sm text-brand hover:underline">
          Open
        </a>
      </td>
    </tr>
  );
}
