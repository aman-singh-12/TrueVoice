/**
 * TrueVoice Tamper-Evident SHA-256 Audit Ledger Viewer.
 * Queries sequential chained audit entries and verifies full cryptographic hash chain integrity.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { AuditLogResponse, AuditChainValidationResult } from '../types/api';

export interface AuditViewerProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AuditViewer: React.FC<AuditViewerProps> = ({
  sessionId,
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [validationResult, setValidationResult] = useState<AuditChainValidationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!sessionId) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const data = await api.getAuditLogs(sessionId);
      setLogs(data);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchLogs();
      setValidationResult(null);
    }
  }, [isOpen, sessionId, fetchLogs]);

  const handleVerifyChain = async () => {
    if (!sessionId) return;
    try {
      setIsVerifying(true);
      setErrorMsg(null);
      const result = await api.verifyAuditChain(sessionId);
      setValidationResult(result);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to verify audit hash chain');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" data-testid="audit-viewer-modal">
      <div className="modal-dialog audit-dialog">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">⛓️</span>
            <div>
              <h2 className="modal-title">TAMPER-EVIDENT AUDIT LEDGER</h2>
              <p className="modal-subtitle">
                Cryptographic SHA-256 Hash Chained Records for Session: <code>{sessionId || 'N/A'}</code>
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body audit-body">
          {/* Verification Actions Bar */}
          <div className="audit-action-bar">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchLogs}
              disabled={isLoading || !sessionId}
            >
              {isLoading ? 'Refreshing...' : '🔄 Refresh Records'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleVerifyChain}
              disabled={isVerifying || !sessionId}
            >
              {isVerifying ? 'Verifying Chain...' : '🛡️ Verify Hash Chain Integrity'}
            </button>
          </div>

          {/* Validation Result Box */}
          {validationResult && (
            <div
              className={`chain-validation-box ${validationResult.is_valid ? 'valid' : 'tampered'}`}
            >
              <div className="validation-header">
                <span className="validation-badge">
                  {validationResult.is_valid ? '✅ HASH CHAIN INTACT' : '🚨 INTEGRITY VIOLATION DETECTED'}
                </span>
                <span className="validation-meta">
                  {validationResult.total_events} Records Verified • {new Date(validationResult.verified_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="validation-message">{validationResult.message}</p>
            </div>
          )}

          {errorMsg && <div className="result-alert error">⚠️ {errorMsg}</div>}

          {/* Records Table */}
          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Seq #</th>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>State</th>
                  <th>Prev Hash (H_(n-1))</th>
                  <th>Event Hash (H_n)</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td className="seq-col">#{log.sequence_id}</td>
                      <td className="time-col">{new Date(log.created_at).toLocaleTimeString()}</td>
                      <td className="event-col">
                        <span className="event-badge">{log.event_type}</span>
                      </td>
                      <td className="state-col">{log.trust_state}</td>
                      <td className="hash-col" title={log.prev_event_hash}>
                        <code>{log.prev_event_hash.slice(0, 10)}...</code>
                      </td>
                      <td className="hash-col highlight" title={log.event_hash}>
                        <code>{log.event_hash.slice(0, 10)}...</code>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="empty-table-cell">
                      {isLoading ? 'Loading audit records...' : 'No audit records recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
