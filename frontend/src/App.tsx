import { useMemo, useState, type ReactNode } from 'react';
import { AppShell } from './layout/AppShell';
import { LoginView } from './views/LoginView';
import { OverviewView } from './views/OverviewView';
import { LiveMonitorView } from './views/LiveMonitorView';
import { SessionsView } from './views/SessionsView';
import { InvestigateView } from './views/InvestigateView';
import { VerificationView } from './views/VerificationView';
import { AuditView } from './views/AuditView';
import { SettingsView } from './views/SettingsView';
import { HelpView } from './views/HelpView';
import { ChallengeModal } from './components/ChallengeModal';
import { useHashRoute } from './hooks/useHashRoute';
import { useRealtimeSession } from './hooks/useRealtimeSession';
import { useSessions } from './hooks/useSessions';
import { api } from './services/api';
import { hrefFor } from './lib/routing';
import { isIncidentSession } from './lib/format';
import type { TokenResponse } from './types/api';

export function App() {
  const { route, go } = useHashRoute();
  const realtime = useRealtimeSession();
  const { sessions } = useSessions();
  const [authVersion, setAuthVersion] = useState(0);
  const authenticated = authVersion >= 0 && api.isAuthenticated;
  const user: TokenResponse | null = api.currentUser;

  const alertCount = useMemo(() => sessions.filter(isIncidentSession).length, [sessions]);

  const onLoginSuccess = () => {
    setAuthVersion((v) => v + 1);
    go('overview');
  };

  const onLogout = () => {
    void realtime.stopSession();
    api.clearAuth();
    setAuthVersion((v) => v + 1);
    window.location.hash = '#/overview';
  };

  const startVerification = () => {
    void realtime.dispatchVerification();
    go('verification');
  };

  if (!authenticated) {
    return <LoginView onSuccess={onLoginSuccess} />;
  }

  let page: ReactNode;
  switch (route.name) {
    case 'monitor':
      page = <LiveMonitorView realtime={realtime} onStartVerification={startVerification} />;
      break;
    case 'sessions':
      page = <SessionsView query={route.query} />;
      break;
    case 'session':
      page = route.sessionId ? (
        <InvestigateView sessionId={route.sessionId} variant="session" />
      ) : (
        <SessionsView query={route.query} />
      );
      break;
    case 'incidents':
      page = <SessionsView query={route.query} incidentOnly />;
      break;
    case 'incident':
      page = route.sessionId ? (
        <InvestigateView sessionId={route.sessionId} variant="incident" />
      ) : (
        <SessionsView query={route.query} incidentOnly />
      );
      break;
    case 'verification':
      page = <VerificationView realtime={realtime} onStartVerification={() => void realtime.dispatchVerification()} />;
      break;
    case 'audit':
      page = <AuditView sessionId={route.sessionId} />;
      break;
    case 'settings':
      page = <SettingsView />;
      break;
    case 'help':
      page = <HelpView />;
      break;
    default:
      page = <OverviewView realtime={realtime} />;
  }

  return (
    <>
      <AppShell
        route={route}
        user={user}
        monitoring={Boolean(realtime.session) && realtime.isMicActive}
        streamStatus={realtime.status}
        alertCount={alertCount}
        search={route.query}
        onSearchSubmit={(value) => {
          window.location.hash = hrefFor('sessions', undefined, value);
        }}
        onLogout={onLogout}
      >
        {page}
      </AppShell>
      <ChallengeModal
        challenge={realtime.activeChallenge}
        isOpen={!!realtime.activeChallenge}
        onClose={realtime.closeChallenge}
        onSubmitVerification={(token, nonce, sig) => realtime.submitVerification(token, nonce, sig)}
      />
    </>
  );
}

export default App;
