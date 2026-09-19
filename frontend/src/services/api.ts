/**
 * TrueVoice Central REST API Client.
 * Manages JWT bearer credentials and executes authenticated requests to backend endpoints.
 */

import type {
  LoginRequest,
  TokenResponse,
  UserResponse,
  SessionTokenResponse,
  SessionCreate,
  SessionResponse,
  SessionDetailResponse,
  AnalystOverrideRequest,
  ChallengeDispatch,
  ChallengeResponse,
  VerificationSubmit,
  VerificationResultSummary,
  RiskAssessmentResponse,
  AuditLogResponse,
  AuditChainValidationResult,
} from '../types/api';

class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

class ApiClient {
  private token: string | null = null;
  private user: TokenResponse | null = null;
  private baseUrl: string = '';

  constructor() {
    // Check if previously stored in sessionStorage for persistence across page refreshes
    const savedToken = sessionStorage.getItem('tv_token');
    const savedUser = sessionStorage.getItem('tv_user');
    if (savedToken && savedUser) {
      try {
        this.token = savedToken;
        this.user = JSON.parse(savedUser);
      } catch {
        this.clearAuth();
      }
    }
  }

  public setAuth(auth: TokenResponse): void {
    this.token = auth.access_token;
    this.user = auth;
    sessionStorage.setItem('tv_token', auth.access_token);
    sessionStorage.setItem('tv_user', JSON.stringify(auth));
  }

  public clearAuth(): void {
    this.token = null;
    this.user = null;
    sessionStorage.removeItem('tv_token');
    sessionStorage.removeItem('tv_user');
  }

  public get isAuthenticated(): boolean {
    return !!this.token;
  }

  public get currentUser(): TokenResponse | null {
    return this.user;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      let errorData: unknown = null;
      try {
        errorData = await response.json();
        if (typeof errorData === 'object' && errorData !== null && 'detail' in errorData) {
          errorMessage = String((errorData as { detail: unknown }).detail);
        }
      } catch {
        // Non-JSON error body
      }
      throw new ApiError(response.status, errorMessage, errorData);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // --- Auth Endpoints ---

  public async login(credentials: LoginRequest): Promise<TokenResponse> {
    const data = await this.request<TokenResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setAuth(data);
    return data;
  }

  public async getProfile(): Promise<UserResponse> {
    return this.request<UserResponse>('/v1/auth/me');
  }

  public async getWebSocketTicket(sessionId: string): Promise<SessionTokenResponse> {
    return this.request<SessionTokenResponse>('/v1/auth/session-token', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  // --- Session Endpoints ---

  public async createSession(data: SessionCreate): Promise<SessionResponse> {
    return this.request<SessionResponse>('/v1/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async listSessions(skip = 0, limit = 50): Promise<SessionResponse[]> {
    return this.request<SessionResponse[]>(`/v1/sessions?skip=${skip}&limit=${limit}`);
  }

  public async getSession(sessionId: string): Promise<SessionDetailResponse> {
    return this.request<SessionDetailResponse>(`/v1/sessions/${sessionId}`);
  }

  public async terminateSession(sessionId: string): Promise<SessionResponse> {
    return this.request<SessionResponse>(`/v1/sessions/${sessionId}/terminate`, {
      method: 'POST',
    });
  }

  public async analystOverride(
    sessionId: string,
    override: AnalystOverrideRequest
  ): Promise<SessionResponse> {
    return this.request<SessionResponse>(`/v1/sessions/${sessionId}/override`, {
      method: 'POST',
      body: JSON.stringify(override),
    });
  }

  // --- Secondary Verification Endpoints ---

  public async dispatchChallenge(
    dispatch: ChallengeDispatch
  ): Promise<ChallengeResponse> {
    return this.request<ChallengeResponse>('/v1/verification/dispatch', {
      method: 'POST',
      body: JSON.stringify(dispatch),
    });
  }

  public async verifyChallenge(
    sessionId: string,
    submission: VerificationSubmit
  ): Promise<VerificationResultSummary> {
    return this.request<VerificationResultSummary>(
      `/v1/verification/verify?session_id=${encodeURIComponent(sessionId)}`,
      {
        method: 'POST',
        body: JSON.stringify(submission),
      }
    );
  }

  // --- Risk Intelligence Endpoints ---

  public async getRiskTimeline(
    sessionId: string,
    skip = 0,
    limit = 100
  ): Promise<RiskAssessmentResponse[]> {
    return this.request<RiskAssessmentResponse[]>(
      `/v1/risk/${sessionId}/timeline?skip=${skip}&limit=${limit}`
    );
  }

  public async getLatestRisk(
    sessionId: string
  ): Promise<RiskAssessmentResponse | null> {
    return this.request<RiskAssessmentResponse | null>(
      `/v1/risk/${sessionId}/latest`
    );
  }

  // --- Audit Ledger Endpoints ---

  public async getAuditLogs(sessionId: string): Promise<AuditLogResponse[]> {
    return this.request<AuditLogResponse[]>(`/v1/audit/${sessionId}/logs`);
  }

  public async verifyAuditChain(
    sessionId: string
  ): Promise<AuditChainValidationResult> {
    return this.request<AuditChainValidationResult>(
      `/v1/audit/${sessionId}/verify-chain`
    );
  }
}

export const api = new ApiClient();
export { ApiError };
