import { SECURITY_ACTION_COPY } from '../lib/format';
import { hrefFor } from '../lib/routing';
import { Button, EmptyState, PageHeader, Panel } from '../components/ui/primitives';
import type { UseRealtimeSessionReturn } from '../hooks/useRealtimeSession';

export function VerificationView({
  realtime,
  onStartVerification,
}: {
  realtime: UseRealtimeSessionReturn;
  onStartVerification: () => void;
}) {
  const action = SECURITY_ACTION_COPY[realtime.securityAction];
  const hasSession = Boolean(realtime.session);

  return (
    <div>
      <PageHeader
        title="Verification"
        description="Out-of-band verification is dispatched by the backend. Success is only shown after the API confirms it."
      />

      {!hasSession ? (
        <EmptyState
          title="No verification requests"
          body="Start a live session first. Verification challenges are bound to an active session."
          action={
            <a href={hrefFor('monitor')} className="text-sm font-medium text-brand hover:underline">
              Go to live monitor
            </a>
          }
        />
      ) : (
        <Panel className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-wide text-mute">Current security action</p>
          <p className="mt-2 text-lg font-semibold">{action.title}</p>
          <p className="mt-1 text-sm text-mute">{action.body}</p>
          {realtime.activeChallenge ? (
            <p className="mt-4 text-sm">A challenge is open. Complete it in the dialog.</p>
          ) : (
            <Button className="mt-4" variant="primary" onClick={onStartVerification}>
              Start verification
            </Button>
          )}
        </Panel>
      )}
    </div>
  );
}
