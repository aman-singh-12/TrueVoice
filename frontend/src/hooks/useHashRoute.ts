import { useCallback, useEffect, useState } from 'react';
import { hrefFor, parseHash, type AppRoute, type RouteName } from '../lib/routing';

export function useHashRoute() {
  const [route, setRoute] = useState<AppRoute>(() => parseHash(window.location.hash));

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '#/overview';
    }
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const go = useCallback((name: RouteName, sessionId?: string, query?: string) => {
    window.location.hash = hrefFor(name, sessionId, query);
  }, []);

  return { route, go };
}
