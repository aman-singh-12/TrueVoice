export type RouteName =
  | 'overview'
  | 'monitor'
  | 'sessions'
  | 'session'
  | 'incidents'
  | 'incident'
  | 'verification'
  | 'audit'
  | 'settings'
  | 'help';

export interface AppRoute {
  name: RouteName;
  sessionId?: string;
  query: string;
}

export function parseHash(hash: string): AppRoute {
  const raw = (hash || '').replace(/^#/, '') || '/overview';
  const [pathPart, queryPart] = raw.split('?');
  const parts = (pathPart || '/overview').split('/').filter(Boolean);
  const query = new URLSearchParams(queryPart || '').get('q') || '';
  const head = parts[0] || 'overview';
  const id = parts[1];

  switch (head) {
    case 'monitor':
      return { name: 'monitor', query };
    case 'sessions':
      return id ? { name: 'session', sessionId: id, query } : { name: 'sessions', query };
    case 'incidents':
      return id ? { name: 'incident', sessionId: id, query } : { name: 'incidents', query };
    case 'verification':
      return { name: 'verification', query };
    case 'audit':
      return id ? { name: 'audit', sessionId: id, query } : { name: 'audit', query };
    case 'settings':
      return { name: 'settings', query };
    case 'help':
      return { name: 'help', query };
    default:
      return { name: 'overview', query };
  }
}

export function hrefFor(name: RouteName, sessionId?: string, query?: string): string {
  const q = query ? `?q=${encodeURIComponent(query)}` : '';
  switch (name) {
    case 'session':
      return `#/sessions/${sessionId ?? ''}${q}`;
    case 'incident':
      return `#/incidents/${sessionId ?? ''}${q}`;
    case 'audit':
      return sessionId ? `#/audit/${sessionId}${q}` : `#/audit${q}`;
    default:
      return `#/${name}${q}`;
  }
}
