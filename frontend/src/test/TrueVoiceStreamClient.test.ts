import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TrueVoiceStreamClient } from '../services/TrueVoiceStreamClient';
import type { RiskTelemetryBroadcast, HandshakeAckMessage } from '../types/telemetry';

// Mock browser WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  public readonly CONNECTING = 0;
  public readonly OPEN = 1;
  public readonly CLOSING = 2;
  public readonly CLOSED = 3;

  public binaryType = 'blob';
  public readyState = 0; // CONNECTING
  public url: string;
  public onopen: (() => void) | null = null;
  public onmessage: ((e: { data: unknown }) => void) | null = null;
  public onerror: ((e: unknown) => void) | null = null;
  public onclose: ((e: { code: number; reason: string; wasClean: boolean }) => void) | null = null;
  public sentMessages: unknown[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate async connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data: unknown) {
    this.sentMessages.push(data);
  }

  close(code = 1000, reason = '') {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose({ code, reason, wasClean: true });
  }

  // Helper for test to receive message from server
  receiveFromServer(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }
}

describe('TrueVoiceStreamClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects to websocket with ticket query parameter', async () => {
    const onTelemetry = vi.fn();
    const onStatusChange = vi.fn();
    const onHandshakeAck = vi.fn();

    const client = new TrueVoiceStreamClient({
      sessionId: 'sess-1234',
      ticketToken: 'ticket-xyz',
      onTelemetry,
      onStatusChange,
      onHandshakeAck,
    });

    const connectPromise = client.connect();
    expect(client.currentStatus).toBe('CONNECTING');

    await connectPromise;
    expect(client.currentStatus).toBe('CONNECTED');

    const wsInstance = MockWebSocket.instances[0];
    expect(wsInstance.url).toContain('/v1/stream/sess-1234?token=ticket-xyz');

    // Simulate server sending HANDSHAKE_ACK
    const ack: HandshakeAckMessage = {
      type: 'HANDSHAKE_ACK',
      session_id: 'sess-1234',
      status: 'STREAM_INITIALIZED',
      source_sample_rate: 16000,
      analysis_window_seconds: 2.0,
      hop_seconds: 0.5,
    };
    wsInstance.receiveFromServer(JSON.stringify(ack));

    expect(client.currentStatus).toBe('STREAMING');
    expect(onHandshakeAck).toHaveBeenCalledWith(ack);
  });

  it('dispatches incoming TELEMETRY broadcasts to callback', async () => {
    const onTelemetry = vi.fn();

    const client = new TrueVoiceStreamClient({
      sessionId: 'sess-1234',
      ticketToken: 'ticket-xyz',
      onTelemetry,
    });

    await client.connect();
    const wsInstance = MockWebSocket.instances[0];

    const telemetry: RiskTelemetryBroadcast = {
      type: 'TELEMETRY',
      session_id: 'sess-1234',
      sequence_id: 5,
      timestamp: '2026-09-18T12:00:00Z',
      risk_score: 82.0,
      risk_tier: 'CRITICAL',
      trust_state: 'BLOCKED',
      breakdown: {
        deepfake: 0.95,
        speaker_similarity: 0.2,
        forensic_anomaly: 0.8,
        conversational_threat: 0.7,
        context_sensitivity: 0.9,
      },
      provenance: {},
      security_action: 'BLOCK',
      detected_intents: ['CREDENTIAL_HARVESTING'],
      transcript_snippet: 'Give me your private keys.',
    };

    wsInstance.receiveFromServer(JSON.stringify(telemetry));

    expect(onTelemetry).toHaveBeenCalledTimes(1);
    expect(onTelemetry).toHaveBeenCalledWith(telemetry);
  });

  it('drops chunks exceeding 64KB size limit to protect against 1009 policy violations', async () => {
    const client = new TrueVoiceStreamClient({
      sessionId: 'sess-1234',
      ticketToken: 'ticket-xyz',
      onTelemetry: vi.fn(),
    });

    await client.connect();
    const wsInstance = MockWebSocket.instances[0];

    // Frame of 65537 bytes (> 64KB)
    const oversized = new ArrayBuffer(65537);
    const sent = client.sendAudioChunk(oversized);
    expect(sent).toBe(false);
    expect(wsInstance.sentMessages.length).toBe(0);

    // Frame of 3200 bytes (valid 100ms at 16kHz)
    const validChunk = new ArrayBuffer(3200);
    const sentValid = client.sendAudioChunk(validChunk);
    expect(sentValid).toBe(true);
    expect(wsInstance.sentMessages.length).toBe(1);
  });

  it('sends END_OF_STREAM frame on disconnect', async () => {
    const client = new TrueVoiceStreamClient({
      sessionId: 'sess-1234',
      ticketToken: 'ticket-xyz',
      onTelemetry: vi.fn(),
    });

    await client.connect();
    const wsInstance = MockWebSocket.instances[0];

    client.disconnect();
    expect(client.currentStatus).toBe('DISCONNECTED');

    // Verify END_OF_STREAM frame sent
    const endFrame = wsInstance.sentMessages.find(
      (msg) => typeof msg === 'string' && msg.includes('END_OF_STREAM')
    );
    expect(endFrame).toBeDefined();
  });
});
