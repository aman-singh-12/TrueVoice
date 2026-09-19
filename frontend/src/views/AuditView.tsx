import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { AuditChainValidationResult, AuditLogResponse, SessionResponse } from '../types/api';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives';
import { TrustBadge } from '../components/ui/badges';
import { formatTimestamp, shortId } from '../lib/format';
import { useSessions } from '../hooks/useSessions';
import { hrefFor } from '../lib/routing';

export function AuditView({ sessionId }: { sessionId?: string }) {
  const { sessions, loading: sessionsLoading } = useSessions();
  const [selected, setSelected] = useState(sessionId || '');
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [validation, setValidation] = useState<AuditChainValidationResult | null>(null);

  useEffect(() => {
    if (sessionId) setSelected(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (!selected && sessions[0]) setSelected(sessions[0].id);
  }, [selected, sessions]);

  const load = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      setValidation(null);
      setLogs(await api.getAuditLogs(id));
    } catch (err) {
      setError((err as Error).message || 'Unable to load audit events.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selected) void load(selected);
  }, [selected]);

  const selectedSession: SessionResponse | undefined = useMemo(
    () => sessions.find((s) => s.id === selected),
    [sessions, selected]
  );

  return (
    <div>
      <PageHeader
        title="Audit"
        description="Tamper-evident event log for a session. Details stay collapsed until you expand a row."
        actions={
          <Button
            size="sm"
            disabled={!selected}
            onClick={async () => {
              if (!selected) return;
              try {
                setValidation(await api.verifyAuditChain(selected));
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            Verify chain
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="audit-session" className="text-sm text-mute">
          Session
        </label>
        <select
          id="audit-session"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            window.location.hash = hrefFor('audit', e.target.value);
          }}
          className="h-9 min-w-[16rem] rounded-md border border-line bg-white px-2 text-sm"
        >
          {sessionsLoading ? <option>Loading…</option> : null}
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {(s.caller_ani || shortId(s.id))} · {s.current_trust_state}
            </option>
          ))}
        </select>
      </div>

      {validation ? (
        <div
          className={`mb-4 rounded-md border px-4 py-3 text-sm ${
            validation.is_valid ? 'border-emerald-200 bg-emerald-50 text-low' : 'border-red-200 bg-red-50 text-crit'
          }`}
        >
          {validation.message} ({validation.total_events} events)
        </div>
      ) : null}

      {error ? <ErrorState title="Audit error" body={error} /> : null}
      {loading ? <Skeleton className="h-48 w-full" /> : null}

      {!loading && !selected ? (
        <EmptyState title="No audit events" body="Select a session with recorded audit history." />
      ) : null}

      {!loading && selected && logs.length === 0 ? (
        <EmptyState title="No audit events" body="This session has no ledger entries yet." />
      ) : null}

      {!loading && logs.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs text-mute">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Session</th>
                <th className="px-4 py-3 font-medium">Hash status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => {
                const actor =
                  (typeof log.payload_json?.actor_id === 'string' && log.payload_json.actor_id) ||
                  (typeof log.payload_json?.actor === 'string' && log.payload_json.actor) ||
                  'System';
                const open = expanded === log.id;
                return (
                  <tr key={log.id} className="border-b border-line align-top">
                    <td className="px-4 py-3 text-mute">{formatTimestamp(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => setExpanded(open ? null : log.id)}
                      >
                        {log.event_type.replace(/_/g, ' ')}
                      </button>
                      {open ? (
                        <pre className="mt-2 max-w-xl overflow-x-auto text-xs text-mute">
                          {JSON.stringify(log.payload_json, null, 2)}
                        </pre>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{actor}</td>
                    <td className="px-4 py-3 font-mono text-xs">{shortId(log.session_id)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs">
                        {log.event_hash ? 'Hashed' : 'Unavailable'}
                        {idx === 0 && selectedSession ? ` · ${selectedSession.current_trust_state}` : ''}
                      </span>
                      {open ? (
                        <div className="mt-2 flex flex-col gap-1 text-xs text-mute">
                          <TrustBadge state={log.trust_state} />
                          <span className="font-mono">prev {shortId(log.prev_event_hash, 12)}</span>
                          <span className="font-mono">hash {shortId(log.event_hash, 12)}</span>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
