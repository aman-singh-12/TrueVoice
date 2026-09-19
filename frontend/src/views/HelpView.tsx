import { PageHeader, Panel } from '../components/ui/primitives';
import { hrefFor } from '../lib/routing';

export function HelpView() {
  return (
    <div>
      <PageHeader
        title="About TrueVoice"
        description="Real-time voice security and trust for live conversations."
      />
      <Panel className="max-w-2xl space-y-4 text-sm leading-6 text-ink">
        <p>
          TrueVoice monitors a live voice session, scores risk from backend detection signals, and recommends a
          security action. The user journey is: sign in, review overview, start or select a session, watch live
          risk, investigate, verify if required, then inspect incidents and the audit log.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <a className="text-brand hover:underline" href={hrefFor('overview')}>
              Overview
            </a>{' '}
            — health and alerts
          </li>
          <li>
            <a className="text-brand hover:underline" href={hrefFor('monitor')}>
              Live monitor
            </a>{' '}
            — current risk and action
          </li>
          <li>
            <a className="text-brand hover:underline" href={hrefFor('sessions')}>
              Sessions
            </a>{' '}
            and{' '}
            <a className="text-brand hover:underline" href={hrefFor('incidents')}>
              Incidents
            </a>
          </li>
          <li>
            <a className="text-brand hover:underline" href={hrefFor('verification')}>
              Verification
            </a>{' '}
            and{' '}
            <a className="text-brand hover:underline" href={hrefFor('audit')}>
              Audit
            </a>
          </li>
        </ol>
        <p className="text-mute">
          Risk scores, trust state, and verification outcomes always come from the TrueVoice backend. Unavailable
          signals are shown as Unavailable — never as zero.
        </p>
      </Panel>
    </div>
  );
}
