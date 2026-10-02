import type { SecurityActionType, TrustState, RiskTier } from '../types/telemetry';
import type { SessionResponse } from '../types/api';

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) {
    return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function elapsedSeconds(startedAt: string, endedAt?: string | null): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, (end - start) / 1000);
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unavailable';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function shortId(id: string, len = 8): string {
  if (!id) return 'Unavailable';
  return id.length <= len ? id : id.slice(0, len);
}

export function roundScore(score: number | null | undefined): number | null {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return null;
  return Math.max(0, Math.min(100, Math.round(Number(score))));
}

export function isActiveSession(session: SessionResponse): boolean {
  return session.ended_at === null && session.current_trust_state !== 'TERMINATED';
}

export function isIncidentSession(session: SessionResponse): boolean {
  const concerning: TrustState[] = [
    'CAUTION',
    'VERIFYING',
    'RESTRICTED',
    'BLOCKED',
    'HUMAN_REVIEW',
  ];
  return concerning.includes(session.current_trust_state);
}

export const SECURITY_ACTION_COPY: Record<
  SecurityActionType,
  { title: string; body: string; cta?: string }
> = {
  ALLOW: {
    title: 'Allow',
    body: 'Risk is within policy. The session may continue without extra friction.',
  },
  WARN: {
    title: 'Advisory warning',
    body: 'Moderate risk was detected. Continue monitoring and be ready to verify.',
  },
  REQUEST_VERIFICATION: {
    title: 'Verification required',
    body: 'Additional verification is required before continuing a sensitive operation.',
    cta: 'Start verification',
  },
  RESTRICT: {
    title: 'Restrict',
    body: 'Sensitive operations are restricted until trust is restored.',
    cta: 'Start verification',
  },
  BLOCK: {
    title: 'Block',
    body: 'Policy blocked this interaction due to critical risk.',
  },
  HUMAN_REVIEW: {
    title: 'Human review',
    body: 'This session is queued for analyst review.',
  },
};

export function friendlyConnectionError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('notallowed') || lower.includes('permission')) {
    return 'Microphone permission is required to start monitoring.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('load failed')) {
    return 'Unable to connect to the TrueVoice backend.';
  }
  if (lower.includes('websocket') || lower.includes('stream')) {
    return 'Live monitoring connection lost.';
  }
  return message;
}

export function connectionLabel(status: string, isMicActive: boolean): string {
  if (status === 'STREAMING' || (status === 'CONNECTED' && isMicActive)) return 'Monitoring';
  if (status === 'CONNECTED') return 'Connected';
  if (status === 'CONNECTING') return 'Connecting';
  if (status === 'ERROR') return 'Error';
  if (status === 'CLOSING') return 'Closing';
  return 'Idle';
}

export const RISK_TIER_LABEL: Record<RiskTier, string> = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  CRITICAL: 'Critical',
};
