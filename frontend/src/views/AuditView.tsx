import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { AuditChainValidationResult, AuditLogResponse, SessionResponse } from '../types/api';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives';
import { TrustBadge } from '../components/ui/badges';
import { formatTimestamp, shortId } from '../lib/format';
import { useSessions } from '../hooks/useSessions';
import { hrefFor } from '../lib/routing';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Lock,
  ScrollText,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

export function AuditView({ sessionId }: { sessionId?: string }) {
  const { sessions, loading: sessionsLoading } = useSessions();
  const [selected, setSelected] = useState(sessionId || '');
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [validation, setValidation] = useState<AuditChainValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

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
      setError((err as Error).message || 'Unable to retrieve audit ledger entries.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selected) void load(selected);
  }, [selected]);

  const handleVerifyChain = async () => {
    if (!selected) return;
    try {
      setValidating(true);
      setError(null);
      const res = await api.verifyAuditChain(selected);
      setValidation(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setValidating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  const selectedSession: SessionResponse | undefined = useMemo(
    () => sessions.find((s) => s.id === selected),
    [sessions, selected]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tamper-Evident Audit Ledger"
        description="Immutable cryptographic event log. Each telemetry evaluation, risk transition, and policy enforcement is sealed with sequential SHA-256 hashes."
        badge={
          <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 font-mono text-xs text-emerald-400">
            <Lock className="h-3 w-3" />
            SHA-256 Hash Chaining
          </span>
        }
        actions={
          <Button
            size="sm"
            variant="primary"
            disabled={!selected || validating}
            onClick={handleVerifyChain}
            className="font-mono gap-1.5"
          >
            <ShieldCheck className="h-4 w-4" />
            {validating ? 'Verifying Hash Chain…' : 'Verify Chain Integrity'}
          </Button>
        }
      />

      {/* Session Selector & Ledger Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-soc-card">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="audit-session" className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Select Voice Session:
          </label>
          <select
            id="audit-session"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              window.location.hash = hrefFor('audit', e.target.value);
            }}
            className="h-10 min-w-[18rem] rounded-lg border border-slate-700 bg-slate-950 px-3 font-mono text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            {sessionsLoading ? <option>Loading voice sessions…</option> : null}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.caller_ani || shortId(s.id))} · {s.current_trust_state} · {shortId(s.id, 8)}
              </option>
            ))}
          </select>
        </div>

        {selectedSession ? (
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400">Ledger State:</span>
            <TrustBadge state={selectedSession.current_trust_state} />
          </div>
        ) : null}
      </div>

      {/* Cryptographic Verification Validation Feedback */}
      {validation ? (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg animate-fadeIn ${
            validation.is_valid
              ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
              : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
          }`}
        >
          {validation.is_valid ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-bold text-sm">
              {validation.is_valid ? 'Chain Integrity Verified' : 'Hash Chain Tamper Warning'}
            </p>
            <p className="text-xs mt-0.5 opacity-90 leading-relaxed font-mono">
              {validation.message} · Total verified events: <strong>{validation.total_events}</strong>
            </p>
          </div>
        </div>
      ) : null}

      {error ? <ErrorState title="Audit Ledger Error" body={error} /> : null}
      {loading ? <Skeleton className="h-64 w-full" /> : null}

      {!loading && !selected ? (
        <EmptyState
          icon={<Database className="h-10 w-10 text-slate-500" />}
          title="No Session Selected"
          body="Choose a voice session to view its cryptographically sealed audit events."
        />
      ) : null}

      {!loading && selected && logs.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-10 w-10 text-slate-500" />}
          title="No Ledger Entries"
          body="This session does not have any recorded audit events yet."
        />
      ) : null}

      {!loading && logs.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-soc-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-slate-800 bg-slate-950 uppercase tracking-wider text-slate-400 text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Event Type</th>
                  <th className="px-5 py-3.5">Actor / Origin</th>
                  <th className="px-5 py-3.5">Session Reference</th>
                  <th className="px-5 py-3.5 text-right">Cryptographic Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {logs.map((log) => {
                  const actor =
                    (typeof log.payload_json?.actor_id === 'string' && log.payload_json.actor_id) ||
                    (typeof log.payload_json?.actor === 'string' && log.payload_json.actor) ||
                    'AI Pipeline Engine';
                  const open = expanded === log.id;

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors align-top">
                      <td className="px-5 py-3 text-slate-400 font-sans whitespace-nowrap">
                        {formatTimestamp(log.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          className="font-bold text-sky-400 hover:underline text-left flex items-center gap-1.5"
                          onClick={() => setExpanded(open ? null : log.id)}
                        >
                          <span>{log.event_type.replace(/_/g, ' ')}</span>
                          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        {open ? (
                          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3.5 space-y-2 max-w-xl">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 uppercase">Trust State at Event:</span>
                              <TrustBadge state={log.trust_state} />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase">Previous Hash Link:</span>
                              <code className="text-[11px] text-slate-300 break-all">
                                {log.prev_event_hash || 'GENESIS_BLOCK'}
                              </code>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase">Event Payload Data:</span>
                              <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-900 p-2 text-[10px] text-slate-300 leading-relaxed">
                                {JSON.stringify(log.payload_json, null, 2)}
                              </pre>
                            </div>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-slate-300">{actor}</td>
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-400">
                        {shortId(log.session_id, 10)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {log.event_hash ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="rounded bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 text-[11px] text-emerald-300">
                              {log.event_hash.slice(0, 10)}…
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(log.event_hash)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                              title="Copy full SHA-256 hash"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Unsealed</span>
                        )}
                        {copiedHash === log.event_hash ? (
                          <p className="text-[10px] text-sky-400 mt-0.5">Copied!</p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
