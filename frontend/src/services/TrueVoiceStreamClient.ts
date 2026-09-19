/**
 * TrueVoice WebSocket Audio Streaming & Telemetry Client.
 * Connects to /v1/stream/{session_id}, executes authentication handshake,
 * streams binary PCM16 frames, and parses real-time RiskTelemetryBroadcast events.
 */

import type {
  RiskTelemetryBroadcast,
  HandshakeAckMessage,
  ServerWebSocketMessage,
} from '../types/telemetry';

export type StreamConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'STREAMING'
  | 'CLOSING'
  | 'ERROR';

export interface TrueVoiceStreamClientOptions {
  sessionId: string;
  ticketToken: string;
  onTelemetry: (telemetry: RiskTelemetryBroadcast) => void;
  onStatusChange?: (status: StreamConnectionStatus) => void;
  onHandshakeAck?: (ack: HandshakeAckMessage) => void;
  onError?: (err: Error) => void;
  onLatencyUpdate?: (latencyMs: number) => void;
}

export class TrueVoiceStreamClient {
  private ws: WebSocket | null = null;
  private status: StreamConnectionStatus = 'DISCONNECTED';
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastPingSentAt = 0;

  private sessionId: string;
  private ticketToken: string;
  private onTelemetry: (telemetry: RiskTelemetryBroadcast) => void;
  private onStatusChange?: (status: StreamConnectionStatus) => void;
  private onHandshakeAck?: (ack: HandshakeAckMessage) => void;
  private onError?: (err: Error) => void;
  private onLatencyUpdate?: (latencyMs: number) => void;

  constructor(options: TrueVoiceStreamClientOptions) {
    this.sessionId = options.sessionId;
    this.ticketToken = options.ticketToken;
    this.onTelemetry = options.onTelemetry;
    this.onStatusChange = options.onStatusChange;
    this.onHandshakeAck = options.onHandshakeAck;
    this.onError = options.onError;
    this.onLatencyUpdate = options.onLatencyUpdate;
  }

  public get currentStatus(): StreamConnectionStatus {
    return this.status;
  }

  private setStatus(newStatus: StreamConnectionStatus): void {
    this.status = newStatus;
    if (this.onStatusChange) {
      this.onStatusChange(newStatus);
    }
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      this.setStatus('CONNECTING');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // If running through Vite dev proxy or custom host
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/v1/stream/${this.sessionId}?token=${encodeURIComponent(this.ticketToken)}`;

      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.setStatus('ERROR');
        reject(error);
        return;
      }

      let connectedResolved = false;

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.startHeartbeat();
        connectedResolved = true;
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data) as ServerWebSocketMessage;
            if (data.type === 'HANDSHAKE_ACK') {
              this.setStatus('STREAMING');
              if (this.onHandshakeAck) {
                this.onHandshakeAck(data);
              }
            } else if (data.type === 'TELEMETRY') {
              this.onTelemetry(data);
            } else if (data.type === 'PONG') {
              if (this.lastPingSentAt > 0 && this.onLatencyUpdate) {
                const rtt = Date.now() - this.lastPingSentAt;
                this.onLatencyUpdate(rtt);
              }
            }
          } catch (err) {
            console.error('Failed to parse WebSocket JSON frame:', err, event.data);
          }
        }
      };

      this.ws.onerror = (_event: Event) => {
        const err = new Error('WebSocket encountered a network or protocol error');
        if (!connectedResolved) {
          connectedResolved = true;
          reject(err);
        }
        if (this.onError) {
          this.onError(err);
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.stopHeartbeat();
        if (event.code === 1008) {
          const err = new Error(`WebSocket authentication failed: ${event.reason}`);
          if (this.onError) this.onError(err);
        } else if (event.code === 1009) {
          const err = new Error('WebSocket frame exceeded 64KB size limit');
          if (this.onError) this.onError(err);
        }

        this.setStatus('DISCONNECTED');
        if (!connectedResolved) {
          connectedResolved = true;
          reject(new Error(`WebSocket closed before connecting (code ${event.code}: ${event.reason})`));
        }
      };
    });
  }

  /**
   * Sends binary PCM16 audio chunk over WebSocket.
   */
  public sendAudioChunk(chunk: ArrayBuffer): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    // Safety clamp: if chunk is too large, do not send to prevent 1009 policy violation
    if (chunk.byteLength > 65536) {
      console.warn(`Attempted to send chunk of ${chunk.byteLength} bytes, exceeding 64KB limit. Dropping.`);
      return false;
    }

    try {
      this.ws.send(chunk);
      return true;
    } catch (err) {
      console.error('Error sending audio chunk:', err);
      return false;
    }
  }

  /**
   * Gracefully close stream with END_OF_STREAM frame.
   */
  public disconnect(): void {
    this.stopHeartbeat();

    if (this.ws) {
      this.setStatus('CLOSING');
      if (this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'END_OF_STREAM' }));
        } catch {
          // Ignore if sending fails during closing
        }
        this.ws.close(1000, 'User stopped stream');
      } else if (this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Connection aborted');
      }
      this.ws = null;
    }

    this.setStatus('DISCONNECTED');
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalId = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingSentAt = Date.now();
        try {
          this.ws.send(JSON.stringify({ type: 'PING', timestamp: this.lastPingSentAt }));
        } catch {
          // Error sending ping
        }
      }
    }, 10000); // Send PING every 10 seconds
  }

  private stopHeartbeat(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }
}
