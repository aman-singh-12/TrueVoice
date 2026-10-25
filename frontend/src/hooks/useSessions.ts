import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { SessionResponse } from '../types/api';

export function useSessions(limit = 50) {
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api.isAuthenticated) {
      setSessions([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await api.listSessions(0, limit);
      setSessions(data);
    } catch (err) {
      setError((err as Error).message || 'Unable to connect to the TrueVoice backend.');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sessions, loading, error, refresh };
}
