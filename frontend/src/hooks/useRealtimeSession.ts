/**
 * React Hook for Real-Time TrueVoice Audio Session & Risk Telemetry.
 * Manages full lifecycle: Session Creation -> Ticket Retrieval -> WebSocket -> Mic Capture -> Live Risk State.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { api, ApiError } from '../services/api';
import { TrueVoiceStreamClient } from '../services/TrueVoiceStreamClient';
import type { StreamConnectionStatus } from '../services/TrueVoiceStreamClient';
import { PcmRecorder } from '../audio/pcm-recorder';
import type {
  RiskTelemetryBroadcast,
  RiskTier,
  TrustState,
  SecurityActionType,
  HandshakeAckMessage,
} from '../types/telemetry';
import type {
  SessionResponse,
  ChallengeResponse,
  VerificationResultSummary,
} from '../types/api';

export interface UseRealtimeSessionReturn {
  session: SessionResponse | null;
  status: StreamConnectionStatus;
  isMicActive: boolean;
  inputVolume: number;
  latestTelemetry: RiskTelemetryBroadcast | null;
  riskHistory: Array<{
    sequence_id: number;
    timestamp: string;
    risk_score: number;
    synthetic_prob: number;
  }>;
  trustState: TrustState;
  riskScore: number;
  riskTier: RiskTier;
  securityAction: SecurityActionType;
  networkLatencyMs: number;
  activeChallenge: ChallengeResponse | null;
  error: string | null;
  startSession: (callerAni?: string) => Promise<void>;
  stopSession: () => Promise<void>;
  toggleMic: () => Promise<void>;
  dispatchVerification: () => Promise<ChallengeResponse | null>;
  submitVerification: (
    challengeToken: string,
    nonce: string,
    signature: string
  ) => Promise<VerificationResultSummary>;
  applyAnalystOverride: (
    action: 'ANALYST_APPROVE' | 'ANALYST_RESTRICT' | 'ANALYST_BLOCK',
    reason: string
  ) => Promise<void>;
  clearError: () => void;
}

export function useRealtimeSession(): UseRealtimeSessionReturn {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [status, setStatus] = useState<StreamConnectionStatus>('DISCONNECTED');
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [inputVolume, setInputVolume] = useState<number>(0);
  const [latestTelemetry, setLatestTelemetry] = useState<RiskTelemetryBroadcast | null>(null);
  const [riskHistory, setRiskHistory] = useState<
    Array<{
      sequence_id: number;
      timestamp: string;
      risk_score: number;
      synthetic_prob: number;
    }>
  >([]);
  const [trustState, setTrustState] = useState<TrustState>('OBSERVING');
  const [riskScore, setRiskScore] = useState<number>(0);
  const [riskTier, setRiskTier] = useState<RiskTier>('LOW');
  const [securityAction, setSecurityAction] = useState<SecurityActionType>('ALLOW');
  const [networkLatencyMs, setNetworkLatencyMs] = useState<number>(0);
  const [activeChallenge, setActiveChallenge] = useState<ChallengeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamClientRef = useRef<TrueVoiceStreamClient | null>(null);
  const pcmRecorderRef = useRef<PcmRecorder | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const handleTelemetry = useCallback((telemetry: RiskTelemetryBroadcast) => {
    setLatestTelemetry(telemetry);
    setRiskScore(telemetry.risk_score);
    setRiskTier(telemetry.risk_tier);
    setTrustState(telemetry.trust_state);
    setSecurityAction(telemetry.security_action);

    // Maintain bounded rolling history (last 60 evaluations = ~30s at 2 evaluations/sec)
    setRiskHistory((prev) => {
      const point = {
        sequence_id: telemetry.sequence_id,
        timestamp: telemetry.timestamp,
        risk_score: telemetry.risk_score,
        synthetic_prob: telemetry.breakdown.deepfake,
      };
      const updated = [...prev, point];
      return updated.length > 60 ? updated.slice(updated.length - 60) : updated;
    });
  }, []);

  const stopAudioAndStream = useCallback(() => {
    if (pcmRecorderRef.current) {
      pcmRecorderRef.current.stop();
      pcmRecorderRef.current = null;
    }
    if (streamClientRef.current) {
      streamClientRef.current.disconnect();
      streamClientRef.current = null;
    }
    setIsMicActive(false);
    setInputVolume(0);
    setStatus('DISCONNECTED');
  }, []);

  const startSession = useCallback(async (callerAni = 'SECURE_CONSOLE') => {
    try {
      setError(null);
      stopAudioAndStream();

      // 1. Create session via REST API
      const newSession = await api.createSession({
        caller_ani: callerAni,
        context_metadata: { source: 'ANALYST_CONSOLE_LIVE' },
      });
      setSession(newSession);
      setTrustState(newSession.current_trust_state);
      setRiskHistory([]);
      setLatestTelemetry(null);
      setRiskScore(0);
      setRiskTier('LOW');
      setSecurityAction('ALLOW');

      // 2. Request short-lived WebSocket ticket
      const ticketRes = await api.getWebSocketTicket(newSession.id);

      // 3. Initialize WebSocket Stream Client
      const client = new TrueVoiceStreamClient({
        sessionId: newSession.id,
        ticketToken: ticketRes.ticket_token,
        onTelemetry: handleTelemetry,
        onStatusChange: (newStatus) => setStatus(newStatus),
        onError: (err) => setError(err.message),
        onLatencyUpdate: (ms) => setNetworkLatencyMs(ms),
        onHandshakeAck: (ack: HandshakeAckMessage) => {
          console.log(`Stream handshake confirmed for session ${ack.session_id}`);
        },
      });
      streamClientRef.current = client;

      // 4. Connect WebSocket
      await client.connect();

      // 5. Initialize & Start Microphone Audio Capture
      const recorder = new PcmRecorder({
        sampleRate: 16000,
        onAudioChunk: (chunk) => {
          client.sendAudioChunk(chunk);
        },
        onVolumeChange: (vol) => {
          setInputVolume(vol);
        },
        onError: (err) => {
          setError(`Microphone error: ${err.message}`);
          setIsMicActive(false);
        },
      });
      pcmRecorderRef.current = recorder;
      await recorder.start();
      setIsMicActive(true);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      setError(`Failed to initiate session: ${msg}`);
      stopAudioAndStream();
    }
  }, [handleTelemetry, stopAudioAndStream]);

  const stopSession = useCallback(async () => {
    try {
      if (session) {
        await api.terminateSession(session.id);
        setTrustState('TERMINATED');
      }
    } catch (err) {
      console.error('Error terminating session on backend:', err);
    } finally {
      stopAudioAndStream();
    }
  }, [session, stopAudioAndStream]);

  const toggleMic = useCallback(async () => {
    if (!session || !streamClientRef.current) return;

    if (isMicActive) {
      if (pcmRecorderRef.current) {
        pcmRecorderRef.current.stop();
        pcmRecorderRef.current = null;
      }
      setIsMicActive(false);
      setInputVolume(0);
    } else {
      try {
        const recorder = new PcmRecorder({
          sampleRate: 16000,
          onAudioChunk: (chunk) => {
            streamClientRef.current?.sendAudioChunk(chunk);
          },
          onVolumeChange: (vol) => {
            setInputVolume(vol);
          },
          onError: (err) => {
            setError(`Microphone error: ${err.message}`);
            setIsMicActive(false);
          },
        });
        pcmRecorderRef.current = recorder;
        await recorder.start();
        setIsMicActive(true);
      } catch (err) {
        setError(`Failed to resume microphone: ${(err as Error).message}`);
      }
    }
  }, [session, isMicActive]);

  const dispatchVerification = useCallback(async () => {
    if (!session) return null;
    try {
      setError(null);
      const res = await api.dispatchChallenge({
        session_id: session.id,
        challenge_type: 'OOB_PUSH',
      });
      setActiveChallenge(res);
      setTrustState('VERIFYING');
      return res;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      setError(`Failed to dispatch challenge: ${msg}`);
      return null;
    }
  }, [session]);

  const submitVerification = useCallback(
    async (challengeToken: string, nonce: string, signature: string) => {
      if (!session) {
        throw new Error('No active session');
      }
      try {
        setError(null);
        const result = await api.verifyChallenge(session.id, {
          challenge_token: challengeToken,
          nonce,
          signature,
        });
        if (result.status === 'SUCCESS') {
          setActiveChallenge(null);
          setTrustState('TRUSTED');
        } else {
          setTrustState('RESTRICTED');
        }
        return result;
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : (err as Error).message;
        setError(`Verification failed: ${msg}`);
        throw err;
      }
    },
    [session]
  );

  const applyAnalystOverride = useCallback(
    async (action: 'ANALYST_APPROVE' | 'ANALYST_RESTRICT' | 'ANALYST_BLOCK', reason: string) => {
      if (!session) return;
      try {
        setError(null);
        const updated = await api.analystOverride(session.id, { action, reason });
        setTrustState(updated.current_trust_state);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : (err as Error).message;
        setError(`Analyst override failed: ${msg}`);
      }
    },
    [session]
  );

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopAudioAndStream();
    };
  }, [stopAudioAndStream]);

  return {
    session,
    status,
    isMicActive,
    inputVolume,
    latestTelemetry,
    riskHistory,
    trustState,
    riskScore,
    riskTier,
    securityAction,
    networkLatencyMs,
    activeChallenge,
    error,
    startSession,
    stopSession,
    toggleMic,
    dispatchVerification,
    submitVerification,
    applyAnalystOverride,
    clearError,
  };
}
